import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { reportNotificationFailure } from '../notifications/notification-error';

@Injectable()
export class RelationshipsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async findFollowStatus(followerId: string, followingId: string) {
    const user = await this.prisma.user.findUnique({
      where: { auth_id: followerId },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException(`User not found for auth_id: ${followerId}`);
    }
    const follow = await this.prisma.follow.findUnique({
      where: {
        follower_id_following_id: {
          follower_id: user.id,
          following_id: followingId,
        },
        deleted_at: null,
      },
    });
    return !!follow;
  }

  async followUser(authId: string, followingId: string) {
    // First get the user id from auth_id
    const user = await this.prisma.user.findUnique({
      where: { auth_id: authId },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException(`User not found for auth_id: ${authId}`);
    }

    // Verify the user being followed exists
    const followingUser = await this.prisma.user.findUnique({
      where: { id: followingId },
      include: { profile: true },
    });

    if (!followingUser) {
      throw new NotFoundException(`User not found with id: ${followingId}`);
    }

    // Prevent follow if either user has blocked the other
    const [iBlock, blockMe] = await Promise.all([
      this.prisma.block.findUnique({
        where: {
          blocker_id_blocked_id: {
            blocker_id: user.id,
            blocked_id: followingId,
          },
        },
      }),
      this.prisma.block.findUnique({
        where: {
          blocker_id_blocked_id: {
            blocker_id: followingId,
            blocked_id: user.id,
          },
        },
      }),
    ]);
    if ((iBlock && !iBlock.deleted_at) || (blockMe && !blockMe.deleted_at)) {
      throw new NotFoundException('Cannot follow due to user block');
    }

    let isNewFollow = false;
    let followRecord = null;

    try {
      // Check if follow relationship already exists
      const existingFollow = await this.prisma.follow.findUnique({
        where: {
          follower_id_following_id: {
            follower_id: user.id,
            following_id: followingId,
          },
        },
      });

      followRecord = await this.prisma.follow.upsert({
        where: {
          follower_id_following_id: {
            follower_id: user.id,
            following_id: followingId,
          },
        },
        update: {
          deleted_at: null,
        },
        create: {
          follower_id: user.id,
          following_id: followingId,
        },
      });

      // Check if this was a new follow (created) vs reactivated (updated)
      isNewFollow = !existingFollow || existingFollow.deleted_at !== null;

      // NOTIFICATIONS: Send follow notifications
      if (isNewFollow) {
        try {
          const followerName = user.profile?.first_name || 'Someone';
          const followingUserName =
            followingUser.profile?.first_name || 'Someone';

          // 1. Notify the followed user about their new follower
          const newFollowerNotification =
            this.notificationsService.createNewFollowerNotification(
              followerName,
            );
          await this.notificationsService.sendNotificationToUser(
            followingId,
            newFollowerNotification,
          );

          // 2. Check if this creates a mutual connection
          const reverseFollow = await this.prisma.follow.findUnique({
            where: {
              follower_id_following_id: {
                follower_id: followingId,
                following_id: user.id,
              },
              deleted_at: null,
            },
          });

          if (reverseFollow) {
            // Mutual connection! Notify both users
            // const mutualNotificationForFollower =
            //   this.notificationsService.createMutualConnectionNotification(
            //     followingUserName,
            //     followingId,
            //   );
            // const mutualNotificationForFollowing =
            //   this.notificationsService.createMutualConnectionNotification(
            //     followerName,
            //     user.id,
            //   );
            // await Promise.all([
            //   this.notificationsService.sendNotificationToUser(
            //     user.id,
            //     mutualNotificationForFollower,
            //   ),
            //   this.notificationsService.sendNotificationToUser(
            //     followingId,
            //     mutualNotificationForFollowing,
            //   ),
            // ]);
            // console.log(
            //   `Sent mutual connection notifications between ${followerName} and ${followingUserName}`,
            // );
          } else {
            // Suggest follow back (but don't be too pushy - delay it)
            const followBackNotification =
              this.notificationsService.createFollowBackSuggestionNotification(
                followerName,
                user.id,
              );

            // Send follow back suggestion after a small delay to avoid notification spam
            setTimeout(async () => {
              try {
                await this.notificationsService.sendNotificationToUser(
                  followingId,
                  followBackNotification,
                );
                console.log(
                  `Sent follow back suggestion to ${followingUserName} for ${followerName}`,
                );
              } catch (error) {
                reportNotificationFailure('follow back suggestion', error);
              }
            }, 5000); // 5 second delay
          }

          console.log(
            `Sent follow notifications for ${followerName} following ${followingUserName}`,
          );
        } catch (error) {
          // Don't fail the follow operation for notification errors
          reportNotificationFailure('follow notifications', error);
        }
      }
    } catch (error) {
      console.error('Error in followUser:', error);
      throw error;
    }

    return followRecord;
  }

  async unfollowUser(authId: string, followingId: string) {
    // First get the user id from auth_id
    const user = await this.prisma.user.findUnique({
      where: { auth_id: authId },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException(`User not found for auth_id: ${authId}`);
    }

    try {
      await this.prisma.follow.update({
        where: {
          follower_id_following_id: {
            follower_id: user.id, // Use the actual user.id, not auth_id
            following_id: followingId,
          },
        },
        data: {
          deleted_at: new Date(),
        },
      });

      // Note: We typically don't send notifications for unfollows as it might be awkward
      // But you could add one here if needed:
      // - "Someone unfollowed you" (might be negative)
      // - Or analytics tracking for internal use

      console.log(`User ${user.id} unfollowed user ${followingId}`);
    } catch (error) {
      // If the follow relationship doesn't exist, that's okay
      if (error.code === 'P2025') {
        return;
      }
      throw error;
    }
  }
}
