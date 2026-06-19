import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { JoinLeaveGroupDto } from './dto/join-leave-group.dto';
import { SearchGroupsDto } from './dto/search-groups.dto';

@Injectable()
export class GroupsService {
  constructor(private prisma: PrismaService) {}

  async createGroup(id: string, createGroupDto: CreateGroupDto) {
    const {
      name,
      description,
      isPublic,
      groupImage,
      groupBanner,
      selectedUsers,
    } = createGroupDto;

    const user = await this.prisma.user.findUnique({
      where: { auth_id: id },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException(`User not found for auth_id: ${id}`);
    }

    try {
      const group = await this.prisma.group.create({
        data: {
          name,
          description,
          isPublic,
          image: groupImage,
          banner: groupBanner,
          members: {
            create: [
              {
                user_id: user.id,
                role: 'ADMIN',
              },
              ...selectedUsers.map((selectedUserId: string) => ({
                user_id: selectedUserId,
                role: 'MEMBER',
              })),
            ],
          },
        },
      });

      return group;
    } catch (error) {
      console.error('Failed to create group:', error);
      return null;
    }
  }

  async updateGroup(id: string, updateGroupDto: UpdateGroupDto) {
    const {
      groupId,
      name,
      description,
      isPublic,
      groupImage,
      groupBanner,
      selectedUsers,
    } = updateGroupDto;

    const user = await this.prisma.user.findUnique({
      where: { auth_id: id },
    });

    if (!user) {
      throw new NotFoundException(`User not found for auth_id: ${id}`);
    }

    // Check if user is admin of the group
    const groupMember = await this.prisma.groupMember.findFirst({
      where: {
        group_id: groupId,
        user_id: user.id,
        role: 'ADMIN',
        deleted_at: null,
      },
    });

    if (!groupMember) {
      throw new ConflictException('User is not an admin of this group');
    }

    try {
      // Start a transaction to update the group and its members
      const updatedGroup = await this.prisma.$transaction(async (prisma) => {
        // Update basic group information
        const group = await prisma.group.update({
          where: { id: groupId },
          data: {
            name,
            description,
            isPublic,
            image: groupImage,
            banner: groupBanner,
            updated_at: new Date(),
          },
        });

        if (selectedUsers?.length) {
          // Get current active members
          const currentMembers = await prisma.groupMember.findMany({
            where: {
              group_id: groupId,
              role: 'MEMBER',
              deleted_at: null,
            },
          });

          const currentMemberIds = currentMembers.map(
            (member) => member.user_id,
          );
          const newMemberIds = selectedUsers;

          // Find members to remove (in current but not in new)
          const membersToRemove = currentMemberIds.filter(
            (id) => !newMemberIds.includes(id),
          );

          // Find members to add (in new but not in current)
          const membersToAdd = newMemberIds.filter(
            (id) => !currentMemberIds.includes(id),
          );

          // Soft delete removed members
          if (membersToRemove.length > 0) {
            await prisma.groupMember.updateMany({
              where: {
                group_id: groupId,
                user_id: { in: membersToRemove },
                deleted_at: null,
              },
              data: {
                deleted_at: new Date(),
              },
            });
          }

          // Add new members
          if (membersToAdd.length > 0) {
            await Promise.all(
              membersToAdd.map((userId) =>
                prisma.groupMember.create({
                  data: {
                    user_id: userId,
                    group_id: groupId,
                    role: 'MEMBER',
                  },
                }),
              ),
            );
          }
        }

        return group;
      });

      return updatedGroup;
    } catch (error) {
      console.error('Failed to update group:', error);
      throw new Error('Failed to update group');
    }
  }

  searchGroups(searchGroupsDto: SearchGroupsDto) {
    const { searchTerm } = searchGroupsDto;

    return this.prisma.group.findMany({
      where: {
        deleted_at: null,
        name: {
          contains: searchTerm,
          mode: 'insensitive',
        },
        isPublic: true,
      },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });
  }

  async findOne(id: string) {
    try {
      const group = await this.prisma.group.findFirst({
        where: {
          id: id,
          deleted_at: null,
        },
        include: {
          members: {
            where: {
              deleted_at: null,
            },
            include: {
              user: {
                include: {
                  profile: {
                    where: {
                      deleted_at: null,
                    },
                  },
                },
              },
            },
          },
          games: {
            where: {
              group_id: id,
              deleted_at: null,
              status: {
                in: ['PLAYERS_REQUIRED'],
              },
            },
            include: {
              creator: {
                include: {
                  profile: true,
                },
              },
              course: true,
              players: {
                include: {
                  user: {
                    include: {
                      profile: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
      return group;
    } catch (error) {
      console.error('Failed to fetch group:', error);
      return null;
    }
  }

  async findUpcomingGames(id: string) {
    try {
      const gameRequests = await this.prisma.game.findMany({
        where: {
          group_id: id,
          deleted_at: null,
          status: 'PLAYERS_REQUIRED',
        },
        include: {
          creator: {
            include: {
              profile: true,
            },
          },
          players: {
            include: {
              user: {
                include: {
                  profile: true,
                },
              },
            },
          },
        },
      });
      return gameRequests;
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  async joinGroup(id: string, joinGroupDto: JoinLeaveGroupDto) {
    const { groupId } = joinGroupDto;

    const user = await this.prisma.user.findUnique({
      where: { auth_id: id },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException(`User not found for auth_id: ${id}`);
    }

    const existingMembership = await this.prisma.groupMember.findFirst({
      where: {
        user_id: user.id,
        group_id: groupId,
      },
    });

    if (existingMembership) {
      if (existingMembership.deleted_at) {
        // If membership exists but is soft deleted, reactivate it
        return this.prisma.groupMember.update({
          where: { id: existingMembership.id },
          data: { deleted_at: null },
        });
      }
      // If membership exists and is not deleted, do nothing
      throw new ConflictException('User is already a member of this group');
    } else {
      // If no membership exists, create a new one
      return this.prisma.groupMember.create({
        data: {
          user_id: user.id,
          group_id: groupId,
          role: 'MEMBER',
        },
      });
    }
  }

  async leaveGroup(id: string, leaveGroupDto: JoinLeaveGroupDto) {
    const { groupId } = leaveGroupDto;

    const user = await this.prisma.user.findUnique({
      where: { auth_id: id },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException(`User not found for auth_id: ${id}`);
    }

    const result = await this.prisma.groupMember.updateMany({
      where: {
        user_id: user.id,
        group_id: groupId,
        deleted_at: null,
      },
      data: {
        deleted_at: new Date(),
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('User is not a member of this group');
    }

    return { success: true };
  }

  update(id: number) {
    return `This action updates a #${id} group`;
  }

  remove(id: number) {
    return `This action removes a #${id} group`;
  }
}
