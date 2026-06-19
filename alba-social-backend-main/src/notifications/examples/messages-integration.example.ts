import { Injectable } from '@nestjs/common';
import { NotificationsService } from '../notifications.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Example integration with Messages module
 * Add these methods to your MessagesService or ChatService
 *
 * To use this:
 * 1. Inject NotificationsService into your MessagesService/ChatService
 * 2. Copy these methods into your service
 * 3. Call sendNewMessageNotification when a new message is sent
 */
@Injectable()
export class MessagesNotificationIntegration {
  constructor(
    private notificationsService: NotificationsService,
    private prisma: PrismaService,
  ) {}

  /**
   * Send new message notification
   * Call this after a message is successfully sent
   */
  async sendNewMessageNotification(
    senderId: string,
    conversationId: string,
    messageContent: string,
  ) {
    // Get sender's information
    const sender = await this.prisma.user.findUnique({
      where: { id: senderId },
      include: { profile: true },
    });

    if (!sender) return;

    // Get all conversation participants except the sender
    const participants = await this.prisma.conversationParticipant.findMany({
      where: {
        conversation_id: conversationId,
        user_id: { not: senderId },
        deleted_at: null,
      },
    });

    const notification = this.notificationsService.createNewMessageNotification(
      conversationId,
      sender.profile?.first_name || 'Someone',
      messageContent,
    );

    // Send notification to all participants except the sender
    for (const participant of participants) {
      await this.notificationsService.sendNotificationToUser(
        participant.user_id,
        notification,
      );
    }
  }

  /**
   * Send notification when someone is added to a group conversation
   * Call this when a user is added to a group chat
   */
  async sendAddedToGroupNotification(
    conversationId: string,
    addedUserId: string,
    adderUserId: string,
  ) {
    const adder = await this.prisma.user.findUnique({
      where: { id: adderUserId },
      include: { profile: true },
    });

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!adder || !conversation) return;

    const notification = {
      title: 'Added to Group Chat',
      body: `${adder.profile?.first_name || 'Someone'} added you to ${conversation.name || 'a group chat'}`,
      data: {
        conversationId,
        action: 'added_to_group',
        addedBy: adderUserId,
      },
      type: 'CHAT' as const,
    };

    await this.notificationsService.sendNotificationToUser(
      addedUserId,
      notification,
    );
  }
}
