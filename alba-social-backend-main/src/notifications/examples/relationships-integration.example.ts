import { Injectable } from '@nestjs/common';
import { NotificationsService } from '../notifications.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Example integration with Relationships module
 * Add these methods to your RelationshipsService
 *
 * To use this:
 * 1. Inject NotificationsService into your RelationshipsService
 * 2. Copy these methods into your RelationshipsService
 * 3. Call sendNewFollowerNotification when someone follows a user
 */
@Injectable()
export class RelationshipsNotificationIntegration {
  constructor(
    private notificationsService: NotificationsService,
    private prisma: PrismaService,
  ) {}

  /**
   * Send new follower notification
   * Call this when a user successfully follows another user
   */
  async sendNewFollowerNotification(followerId: string, followingId: string) {
    // Get follower's information
    const follower = await this.prisma.user.findUnique({
      where: { id: followerId },
      include: { profile: true },
    });

    if (!follower) return;

    const notification =
      this.notificationsService.createNewFollowerNotification(
        follower.profile?.first_name || 'Someone',
      );

    await this.notificationsService.sendNotificationToUser(
      followingId,
      notification,
    );
  }

  /**
   * Send notification when someone accepts a follow request (if you have follow requests)
   * Call this if you implement a follow request system
   */
  async sendFollowRequestAcceptedNotification(
    requesterId: string,
    accepterId: string,
  ) {
    const accepter = await this.prisma.user.findUnique({
      where: { id: accepterId },
      include: { profile: true },
    });

    if (!accepter) return;

    const notification = {
      title: 'Follow Request Accepted',
      body: `${accepter.profile?.first_name || 'Someone'} accepted your follow request`,
      data: {
        userId: accepterId,
        action: 'follow_request_accepted',
      },
      type: 'FOLLOW' as const,
    };

    await this.notificationsService.sendNotificationToUser(
      requesterId,
      notification,
    );
  }
}
