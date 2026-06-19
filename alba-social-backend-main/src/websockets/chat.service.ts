import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConversationDto } from 'src/conversations/dto/create-conversation.dto';
import { CreateMessageDto } from 'src/messages/dto/create-message.dto';
import { getOrCreateConversationDto } from 'src/conversations/dto/get-or-create-conversation.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { reportNotificationFailure } from '../notifications/notification-error';

interface ActiveUserSession {
  userId: string;
  conversationId: string;
  lastActivity: Date;
}

interface PendingNotification {
  userId: string;
  conversationId: string;
  senderName: string;
  lastMessageContent: string;
  messageCount: number;
  conversationType: 'DIRECT' | 'GAME' | 'GROUP';
  conversationName?: string;
  firstMessageTime: Date;
}

@Injectable()
export class ChatService {
  private activeUsers = new Map<string, ActiveUserSession>(); // socketId -> session
  private pendingNotifications = new Map<string, PendingNotification>(); // userId-conversationId -> notification
  private notificationTimeouts = new Map<string, NodeJS.Timeout>(); // userId-conversationId -> timeout

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  // Track when users join/leave conversations
  trackUserActivity(socketId: string, userId: string, conversationId: string) {
    this.activeUsers.set(socketId, {
      userId,
      conversationId,
      lastActivity: new Date(),
    });

    // Cancel any pending notifications for this user in this conversation
    const pendingKey = `${userId}-${conversationId}`;
    if (this.notificationTimeouts.has(pendingKey)) {
      clearTimeout(this.notificationTimeouts.get(pendingKey));
      this.notificationTimeouts.delete(pendingKey);
      this.pendingNotifications.delete(pendingKey);
    }
  }

  // Remove user activity tracking
  removeUserActivity(socketId: string) {
    this.activeUsers.delete(socketId);
  }

  // Get user by Firebase auth ID for websocket authentication
  async getUserByAuthId(authId: string) {
    return this.prisma.user.findUnique({
      where: { auth_id: authId },
      include: { profile: true },
    });
  }

  // Check if user is currently active in a conversation
  private isUserActiveInConversation(
    userId: string,
    conversationId: string,
  ): boolean {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    for (const session of this.activeUsers.values()) {
      if (
        session.userId === userId &&
        session.conversationId === conversationId &&
        session.lastActivity > fiveMinutesAgo
      ) {
        return true;
      }
    }
    return false;
  }

  async createConversation(createConversationDto: CreateConversationDto) {
    const { participantIds, ...conversationData } = createConversationDto;

    return this.prisma.conversation.create({
      data: {
        ...conversationData,
        participants: {
          create: participantIds.map((userId) => ({
            user: { connect: { id: userId } },
          })),
        },
      },
      include: { participants: true },
    });
  }

  async getOrCreateConversation(
    id: string,
    getOrCreateConversationDto: getOrCreateConversationDto,
  ) {
    const { profileId, gameId } = getOrCreateConversationDto;
    const user = await this.prisma.user.findUnique({
      where: { auth_id: id },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException(`User not found for auth_id: ${id}`);
    }

    if (!profileId && !gameId) {
      throw new NotFoundException(`A profile or game ID must be provided`);
    }

    if (profileId) {
      // Block checks for direct conversations
      const [iBlock, blockMe] = await Promise.all([
        this.prisma.block.findUnique({
          where: {
            blocker_id_blocked_id: {
              blocker_id: user.id,
              blocked_id: profileId,
            },
          },
        }),
        this.prisma.block.findUnique({
          where: {
            blocker_id_blocked_id: {
              blocker_id: profileId,
              blocked_id: user.id,
            },
          },
        }),
      ]);
      if ((iBlock && !iBlock.deleted_at) || (blockMe && !blockMe.deleted_at)) {
        throw new NotFoundException(
          'Cannot start conversation due to user block',
        );
      }

      return this.getOrCreateDirectConversation(user.id, profileId);
    } else if (gameId) {
      return this.getOrCreateGameRequestConversation(gameId, user.id);
    } else {
      throw new Error('Either profileId or gameRequestId must be provided');
    }
  }

  private async getOrCreateDirectConversation(
    userId: string,
    profileId: string,
  ) {
    const existingChat = await this.prisma.conversation.findFirst({
      where: {
        AND: [
          { type: 'DIRECT' },
          {
            participants: {
              every: {
                user_id: { in: [userId, profileId] },
              },
            },
          },
          {
            participants: {
              none: {
                user_id: { notIn: [userId, profileId] },
              },
            },
          },
        ],
      },
      include: {
        participants: true,
      },
    });

    if (existingChat) {
      return { conversation: existingChat };
    }

    const conversation = await this.prisma.conversation.create({
      data: {
        type: 'DIRECT',
        participants: {
          create: [{ user_id: userId }, { user_id: profileId }],
        },
      },
      include: {
        participants: true,
      },
    });

    return { conversation };
  }

  private async getOrCreateGameRequestConversation(
    gameId: string,
    userId: string,
  ) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: { players: true },
    });

    if (!game) {
      throw new NotFoundException(`Game request not found: ${gameId}`);
    }

    let conversation = await this.prisma.conversation.findFirst({
      where: {
        game_id: gameId,
      },
      include: {
        participants: true,
      },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          type: 'GAME',
          game_id: gameId,
          participants: {
            create: [...game.players.map((p) => ({ user_id: p.user_id }))],
          },
        },
        include: {
          participants: true,
        },
      });
    }

    const isParticipant = conversation.participants.some(
      (p) => p.user_id === userId,
    );
    if (!isParticipant) {
      return { conversation, isParticipant: false };
    }

    return { conversation, isParticipant: true };
  }

  async getConversations(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        participants: {
          some: { user_id: userId },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              include: {
                profile: true,
              },
            },
          },
        },
        messages: {
          take: 1,
          orderBy: { created_at: 'desc' },
        },
        game: {
          include: {
            course: true,
          },
        },
        group: true,
      },
      orderBy: { updated_at: 'desc' },
    });

    // Add formatted title for game conversations
    return conversations.map((conversation) => {
      if (conversation.type === 'GAME' && conversation.game) {
        const game = conversation.game;
        const courseName = game.course?.name || 'Course';
        const firstWord = courseName.split(' ')[0];
        const gameDate = new Date(game.date);
        const formattedDate = gameDate.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: '2-digit',
        });

        return {
          ...conversation,
          formatted_title: `${firstWord} - ${formattedDate}`,
        };
      }

      return conversation;
    });
  }

  async getMessages(conversationId: string) {
    return this.prisma.message.findMany({
      where: { conversation_id: conversationId },
      orderBy: { created_at: 'asc' },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
    });
  }

  async createMessage(createMessageDto: CreateMessageDto) {
    console.log('[ChatService] Starting to create message:', createMessageDto);

    try {
      // Block check: prevent messaging if any participant blocked the sender
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: createMessageDto.conversation_id },
        include: { participants: true },
      });
      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }
      const recipientIds = conversation.participants
        .map((p) => p.user_id)
        .filter((uid) => uid !== createMessageDto.user_id);
      const blockedEitherWay = await this.prisma.block.findFirst({
        where: {
          deleted_at: null,
          OR: recipientIds.flatMap((rid) => [
            { blocker_id: createMessageDto.user_id, blocked_id: rid },
            { blocker_id: rid, blocked_id: createMessageDto.user_id },
          ]),
        },
      });
      if (blockedEitherWay) {
        throw new NotFoundException('Cannot message this user');
      }

      // Use a transaction to ensure both message creation and conversation update happen together
      const result = await this.prisma.$transaction(async (tx) => {
        // Create the message
        const message = await tx.message.create({
          data: createMessageDto,
          include: {
            user: {
              include: {
                profile: true,
              },
            },
            conversation: {
              include: {
                participants: {
                  where: { deleted_at: null },
                  include: {
                    user: {
                      include: {
                        profile: true,
                        notification_settings: true,
                      },
                    },
                  },
                },
                game: {
                  include: {
                    course: true,
                  },
                },
                group: true,
              },
            },
          },
        });

        // Update the conversation's updated_at timestamp to reflect the new message
        await tx.conversation.update({
          where: { id: createMessageDto.conversation_id },
          data: { updated_at: new Date() },
        });

        return message;
      });

      // NOTIFICATION: Send smart notifications to other participants
      await this.handleMessageNotifications(result);

      console.log('[ChatService] Message created successfully:', result);
      return result;
    } catch (error) {
      console.error('[ChatService] Error creating message:', error);
      throw error;
    }
  }

  private async handleMessageNotifications(message: any) {
    try {
      const senderName = message.user.profile?.first_name || 'Someone';
      const otherParticipants = message.conversation.participants.filter(
        (p) => p.user_id !== message.user_id,
      );

      for (const participant of otherParticipants) {
        // Check if user has chat notifications enabled
        const settings = participant.user.notification_settings;
        if (settings && !settings.chat_notifications) {
          continue; // Skip if chat notifications are disabled
        }

        // Check if user is currently active in this conversation
        if (
          this.isUserActiveInConversation(
            participant.user_id,
            message.conversation_id,
          )
        ) {
          console.log(
            `User ${participant.user_id} is active in conversation, skipping notification`,
          );
          continue;
        }

        // Handle notification grouping
        await this.handleGroupedNotification(
          participant.user_id,
          message.conversation_id,
          senderName,
          message.content,
          message.conversation.type,
          this.getConversationName(message.conversation),
        );
      }
    } catch (error) {
      reportNotificationFailure('message notifications', error);
    }
  }

  private async handleGroupedNotification(
    userId: string,
    conversationId: string,
    senderName: string,
    messageContent: string,
    conversationType: 'DIRECT' | 'GAME' | 'GROUP',
    conversationName?: string,
  ) {
    const pendingKey = `${userId}-${conversationId}`;
    const existing = this.pendingNotifications.get(pendingKey);

    if (existing) {
      // Update existing pending notification
      existing.messageCount++;
      existing.lastMessageContent = messageContent;

      // If it's been more than 30 seconds since first message, send grouped notification
      const timeSinceFirst = Date.now() - existing.firstMessageTime.getTime();
      if (timeSinceFirst > 30000) {
        await this.sendGroupedNotification(existing);
        this.clearPendingNotification(pendingKey);
      }
    } else {
      // Create new pending notification
      const pending: PendingNotification = {
        userId,
        conversationId,
        senderName,
        lastMessageContent: messageContent,
        messageCount: 1,
        conversationType,
        conversationName,
        firstMessageTime: new Date(),
      };

      this.pendingNotifications.set(pendingKey, pending);

      // Set timeout to send notification after 5 seconds if no more messages
      const timeout = setTimeout(async () => {
        const currentPending = this.pendingNotifications.get(pendingKey);
        if (currentPending) {
          if (currentPending.messageCount === 1) {
            await this.sendSingleMessageNotification(currentPending);
          } else {
            await this.sendGroupedNotification(currentPending);
          }
          this.clearPendingNotification(pendingKey);
        }
      }, 5000);

      this.notificationTimeouts.set(pendingKey, timeout);
    }
  }

  private async sendSingleMessageNotification(pending: PendingNotification) {
    try {
      let notification;

      switch (pending.conversationType) {
        case 'DIRECT':
          notification =
            this.notificationsService.createNewDirectMessageNotification(
              pending.conversationId,
              pending.senderName,
              pending.lastMessageContent,
            );
          break;
        case 'GAME':
          notification =
            this.notificationsService.createNewGameMessageNotification(
              pending.conversationId,
              pending.senderName,
              pending.lastMessageContent,
              pending.conversationName || 'Game Chat',
            );
          break;
        case 'GROUP':
          notification =
            this.notificationsService.createNewGroupMessageNotification(
              pending.conversationId,
              pending.senderName,
              pending.lastMessageContent,
              pending.conversationName || 'Group Chat',
            );
          break;
      }

      if (notification) {
        await this.notificationsService.sendNotificationToUser(
          pending.userId,
          notification,
        );
      }
    } catch (error) {
      reportNotificationFailure('single message notification', error);
    }
  }

  private async sendGroupedNotification(pending: PendingNotification) {
    try {
      const notification =
        this.notificationsService.createMultipleMessagesNotification(
          pending.conversationId,
          pending.senderName,
          pending.messageCount,
          pending.conversationType,
          pending.conversationName,
        );

      await this.notificationsService.sendNotificationToUser(
        pending.userId,
        notification,
      );
    } catch (error) {
      reportNotificationFailure('grouped notification', error);
    }
  }

  private clearPendingNotification(pendingKey: string) {
    const timeout = this.notificationTimeouts.get(pendingKey);
    if (timeout) {
      clearTimeout(timeout);
      this.notificationTimeouts.delete(pendingKey);
    }
    this.pendingNotifications.delete(pendingKey);
  }

  private getConversationName(conversation: any): string | undefined {
    if (conversation.type === 'GAME') {
      return (
        conversation.game?.course?.name ||
        conversation.game?.location ||
        'Game Chat'
      );
    } else if (conversation.type === 'GROUP') {
      return conversation.group?.name || 'Group Chat';
    }
    return undefined;
  }
}
