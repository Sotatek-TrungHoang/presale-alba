import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  PushNotificationService,
  NotificationPayload,
  PushSendResult,
} from './push-notification.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { RegisterTokenDto } from './dto/register-token.dto';
import { UpdateNotificationSettingsDto } from './dto/notification-settings.dto';
import { NotificationEntity } from './entities/notification.entity';
import {
  NotificationDeliveryStatus,
  NotificationType,
  Prisma,
  PushToken,
} from '@prisma/client';

/**
 * `data.action` tag for the weekly "games near you" notification. Shared so the
 * scheduled job can both create and dedupe these notifications by the same key.
 */
export const GAMES_NEARBY_WEEKLY_ACTION = 'games_nearby_weekly';

/**
 * `data.action` tag for the "last call" reminder sent to players who still owe
 * for a game happening within the next 24 hours. Shared so the scheduled job
 * can both create and dedupe these notifications by the same key.
 */
export const UNPAID_GAME_REMINDER_ACTION = 'unpaid_game_reminder';

/**
 * `data.action` tag for the "playing tomorrow" reminder sent to players of a
 * ready game happening within the next 24 hours. Shared so the scheduled job
 * can both create and dedupe these notifications by the same key.
 */
export const PLAYING_TOMORROW_ACTION = 'playing_tomorrow';

/**
 * `data.action` tag for the "under capacity" nudge sent to the organiser of a
 * game happening within the next 24 hours that still needs players. Shared so
 * the scheduled job can both create and dedupe these notifications by the same
 * key.
 */
export const UNDER_CAPACITY_NUDGE_ACTION = 'under_capacity_nudge';

/**
 * `data.action` tag for the "payout on its way" notification sent to the
 * organiser the day after a completed round. Shared so the scheduled job can
 * both create and dedupe these notifications by the same key.
 */
export const PAYOUT_ON_ITS_WAY_ACTION = 'payout_on_its_way';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private pushNotificationService: PushNotificationService,
  ) {}

  private buildDeliveryRows(
    notificationId: string,
    sendResults: PushSendResult[],
    tokenIdByToken: Map<string, string>,
  ): Prisma.NotificationDeliveryCreateManyInput[] {
    return sendResults.map((result) => {
      const base = {
        notification_id: notificationId,
        push_token_id: tokenIdByToken.get(result.token) ?? null,
        token: result.token,
      };
      if (result.outcome.status === 'ok') {
        return {
          ...base,
          ticket_id: result.outcome.ticketId,
          status: NotificationDeliveryStatus.SENT,
        };
      }
      return {
        ...base,
        status: NotificationDeliveryStatus.ERROR,
        error_code:
          result.outcome.status === 'error'
            ? result.outcome.errorCode ?? null
            : 'InvalidToken',
        error_message: result.outcome.errorMessage,
      };
    });
  }

  private async recordDeliveries(
    notificationId: string,
    sendResults: PushSendResult[],
    pushTokens: PushToken[],
  ): Promise<void> {
    if (sendResults.length === 0) return;
    const tokenIdByToken = new Map(pushTokens.map((pt) => [pt.token, pt.id]));
    const rows = this.buildDeliveryRows(
      notificationId,
      sendResults,
      tokenIdByToken,
    );
    try {
      await this.prisma.notificationDelivery.createMany({ data: rows });
    } catch (error) {
      this.logger.error(
        `Failed to record notification deliveries for notification ${notificationId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Register a push token for a user
   */
  async registerPushToken(
    userId: string,
    registerTokenDto: RegisterTokenDto,
  ): Promise<void> {
    const { token, platform } = registerTokenDto;

    // Deactivate any existing tokens for this user on this platform
    await this.prisma.pushToken.updateMany({
      where: {
        user_id: userId,
        platform,
        is_active: true,
      },
      data: {
        is_active: false,
      },
    });

    // Create or update the token
    await this.prisma.pushToken.upsert({
      where: { token },
      update: {
        user_id: userId,
        platform,
        is_active: true,
        updated_at: new Date(),
      },
      create: {
        user_id: userId,
        token,
        platform,
        is_active: true,
      },
    });
  }

  /**
   * Get user's notifications
   */
  async getUserNotifications(userId: string): Promise<NotificationEntity[]> {
    const notifications = await this.prisma.notification.findMany({
      where: {
        user_id: userId,
        deleted_at: null,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return notifications.map((notification) => ({
      id: notification.id,
      title: notification.title,
      body: notification.body,
      data: notification.data,
      timestamp: notification.created_at.toISOString(),
      read: notification.read,
      type: notification.type,
    }));
  }

  /**
   * Mark notification as read
   */
  async markNotificationAsRead(
    userId: string,
    notificationId: string,
  ): Promise<void> {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        user_id: userId,
        deleted_at: null,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: {
        user_id: userId,
        read: false,
        deleted_at: null,
      },
      data: {
        read: true,
      },
    });
  }

  /**
   * Delete a notification
   */
  async deleteNotification(
    userId: string,
    notificationId: string,
  ): Promise<void> {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        user_id: userId,
        deleted_at: null,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { deleted_at: new Date() },
    });
  }

  /**
   * Send notification to a specific user
   */
  async sendNotificationToUser(
    userId: string,
    createNotificationDto: CreateNotificationDto,
  ): Promise<void> {
    const { title, body, data, type } = createNotificationDto;

    // Check if user has notifications enabled for this type
    const settings = await this.getUserNotificationSettings(userId);
    if (!this.isNotificationTypeEnabled(type, settings)) {
      return; // Skip sending if notifications are disabled for this type
    }

    // Save notification to database
    const notification = await this.prisma.notification.create({
      data: {
        user_id: userId,
        title,
        body,
        data,
        type,
      },
    });

    // Get user's active push tokens
    const pushTokens = await this.prisma.pushToken.findMany({
      where: {
        user_id: userId,
        is_active: true,
        deleted_at: null,
      },
    });

    if (pushTokens.length > 0) {
      const tokens = pushTokens.map((pt) => pt.token);

      // Configure notification payload based on type and content
      const notificationPayload = await this.buildNotificationPayload(
        title,
        body,
        data,
        type,
        userId,
      );

      const sendResults = await this.pushNotificationService.sendNotificationToTokens(
        tokens,
        notificationPayload,
      );
      await this.recordDeliveries(notification.id, sendResults, pushTokens);
    }
  }

  /**
   * Send notification to all users
   */
  async sendNotificationToAll(
    createNotificationDto: CreateNotificationDto,
  ): Promise<void> {
    const { title, body, data, type } = createNotificationDto;

    // Get all users who have this notification type enabled
    const usersWithSettings = await this.prisma.user.findMany({
      where: {
        deleted_at: null,
      },
      include: {
        notification_settings: true,
        push_tokens: {
          where: {
            is_active: true,
            deleted_at: null,
          },
        },
      },
    });

    const validUsers = usersWithSettings.filter((user) => {
      const settings = user.notification_settings;
      return this.isNotificationTypeEnabled(type, settings);
    });

    if (validUsers.length === 0) return;

    // Create one notification row per recipient, returning ids so we can map
    // tickets back to the right user.
    const notifications = await this.prisma.notification.createManyAndReturn({
      data: validUsers.map((user) => ({
        user_id: user.id,
        title,
        body,
        data,
        type,
      })),
      select: { id: true, user_id: true },
    });
    const notificationByUser = new Map(
      notifications.map((n) => [n.user_id, n.id]),
    );

    // For broadcast notifications, we'll use a generic badge count of 1
    // since we can't efficiently calculate individual user badge counts
    const notificationPayload: NotificationPayload = {
      title,
      body,
      data: { ...data, type },
      sound: 'default',
      badge: 1,
      priority: type === NotificationType.GENERAL ? 'high' : 'normal',
      channelId: this.getChannelIdForType(type),
      ttl: this.getTTLForType(type, data),
    };

    for (const user of validUsers) {
      if (user.push_tokens.length === 0) continue;
      const notificationId = notificationByUser.get(user.id);
      if (!notificationId) continue;
      const tokens = user.push_tokens.map((pt) => pt.token);
      const sendResults = await this.pushNotificationService.sendNotificationToTokens(
        tokens,
        notificationPayload,
      );
      await this.recordDeliveries(
        notificationId,
        sendResults,
        user.push_tokens,
      );
    }
  }

  /**
   * Get user's notification settings
   */
  async getUserNotificationSettings(userId: string): Promise<any> {
    let settings = await this.prisma.notificationSettings.findUnique({
      where: { user_id: userId },
    });

    if (!settings) {
      // Create default settings if they don't exist
      settings = await this.prisma.notificationSettings.create({
        data: {
          user_id: userId,
          game_notifications: true,
          chat_notifications: true,
          follow_notifications: true,
          general_notifications: true,
        },
      });
    }

    return {
      gameNotifications: settings.game_notifications,
      chatNotifications: settings.chat_notifications,
      followNotifications: settings.follow_notifications,
      generalNotifications: settings.general_notifications,
    };
  }

  /**
   * Update user's notification settings
   */
  async updateNotificationSettings(
    userId: string,
    updateDto: UpdateNotificationSettingsDto,
  ): Promise<any> {
    const data: any = {};

    if (updateDto.gameNotifications !== undefined) {
      data.game_notifications = updateDto.gameNotifications;
    }
    if (updateDto.chatNotifications !== undefined) {
      data.chat_notifications = updateDto.chatNotifications;
    }
    if (updateDto.followNotifications !== undefined) {
      data.follow_notifications = updateDto.followNotifications;
    }
    if (updateDto.generalNotifications !== undefined) {
      data.general_notifications = updateDto.generalNotifications;
    }

    const settings = await this.prisma.notificationSettings.upsert({
      where: { user_id: userId },
      update: data,
      create: {
        user_id: userId,
        game_notifications: updateDto.gameNotifications ?? true,
        chat_notifications: updateDto.chatNotifications ?? true,
        follow_notifications: updateDto.followNotifications ?? true,
        general_notifications: updateDto.generalNotifications ?? true,
      },
    });

    return {
      gameNotifications: settings.game_notifications,
      chatNotifications: settings.chat_notifications,
      followNotifications: settings.follow_notifications,
      generalNotifications: settings.general_notifications,
    };
  }

  /**
   * Helper method to check if notification type is enabled
   */
  private isNotificationTypeEnabled(
    type: NotificationType,
    settings: any,
  ): boolean {
    if (!settings) return true; // Default to enabled if no settings

    switch (type) {
      case NotificationType.GAME:
        return settings.game_notifications ?? true;
      case NotificationType.CHAT:
        return settings.chat_notifications ?? true;
      case NotificationType.FOLLOW:
        return settings.follow_notifications ?? true;
      case NotificationType.GENERAL:
        return settings.general_notifications ?? true;
      default:
        return true;
    }
  }

  /**
   * Get unread notification count for badge
   */
  private async getUnreadNotificationCount(userId: string): Promise<number> {
    return await this.prisma.notification.count({
      where: {
        user_id: userId,
        read: false,
        deleted_at: null,
      },
    });
  }

  /**
   * Build a complete notification payload with proper configuration based on type
   */
  private async buildNotificationPayload(
    title: string,
    body: string,
    data: any,
    type: NotificationType,
    userId: string,
  ): Promise<NotificationPayload> {
    // Get unread count for badge
    const badgeCount = await this.getUnreadNotificationCount(userId);

    // Base payload
    const payload: NotificationPayload = {
      title,
      body,
      data: { ...data, type },
      sound: 'default',
      badge: badgeCount > 0 ? badgeCount : 1, // Show at least 1 if this is a new notification
    };

    // Configure based on notification type
    switch (type) {
      case NotificationType.CHAT:
        payload.priority = 'high';
        payload.channelId = 'chat_messages';
        payload.sound = 'default';
        payload.ttl = 3600; // 1 hour for chat messages
        break;

      case NotificationType.GAME:
        // Different priorities for different game actions
        if (data.action === 'invite' || data.action === 'join_request') {
          payload.priority = 'high';
          payload.sound = 'default';
        } else if (
          data.action === 'payment_failed' ||
          data.action === 'ready_to_book'
        ) {
          payload.priority = 'high';
          payload.sound = 'default';
        } else if (data.action === 'reminder') {
          payload.priority = 'high';
          payload.sound = 'default';
          payload.ttl = 1800; // 30 minutes for game reminders
        } else {
          payload.priority = 'normal';
          payload.sound = 'default';
        }
        payload.channelId = 'game_updates';
        payload.ttl = payload.ttl || 86400; // 24 hours for game notifications
        break;

      case NotificationType.FOLLOW:
        payload.priority = 'normal';
        payload.channelId = 'social_updates';
        payload.sound = 'default';
        payload.ttl = 604800; // 7 days for follow notifications
        break;

      case NotificationType.GENERAL:
        // Different priorities for different general actions
        if (
          data.action?.includes('payment') ||
          data.action?.includes('refund') ||
          data.action?.includes('payout')
        ) {
          payload.priority = 'high'; // Financial notifications are high priority
          payload.sound = 'default';
          payload.channelId = 'financial_updates';
          payload.ttl = 604800; // 7 days for financial notifications
        } else if (data.action?.includes('complaint')) {
          payload.priority = 'high';
          payload.sound = 'default';
          payload.channelId = 'support_updates';
          payload.ttl = 604800; // 7 days for support notifications
        } else if (data.action === 'account_verified') {
          payload.priority = 'high';
          payload.sound = 'default';
          payload.channelId = 'account_updates';
          payload.ttl = 604800; // 7 days for account notifications
        } else {
          payload.priority = 'normal';
          payload.sound = 'default';
          payload.channelId = 'general_updates';
          payload.ttl = 604800; // 7 days for general notifications
        }
        break;

      default:
        payload.priority = 'normal';
        payload.channelId = 'default';
        payload.ttl = 86400; // 24 hours default
        break;
    }

    return payload;
  }

  /**
   * Get channel ID based on notification type
   */
  private getChannelIdForType(type: NotificationType): string {
    switch (type) {
      case NotificationType.CHAT:
        return 'chat_messages';
      case NotificationType.GAME:
        return 'game_updates';
      case NotificationType.FOLLOW:
        return 'social_updates';
      case NotificationType.GENERAL:
        return 'general_updates';
      default:
        return 'default';
    }
  }

  /**
   * Get TTL based on notification type and action
   */
  private getTTLForType(type: NotificationType, data: any): number {
    switch (type) {
      case NotificationType.CHAT:
        return 3600; // 1 hour
      case NotificationType.GAME:
        if (data.action === 'reminder') {
          return 1800; // 30 minutes for reminders
        }
        return 86400; // 24 hours
      case NotificationType.FOLLOW:
        return 604800; // 7 days
      case NotificationType.GENERAL:
        if (
          data.action?.includes('payment') ||
          data.action?.includes('refund') ||
          data.action?.includes('payout')
        ) {
          return 604800; // 7 days for financial
        }
        return 604800; // 7 days default
      default:
        return 86400; // 24 hours default
    }
  }

  /**
   * Create notification templates for common scenarios
   */
  createGameInviteNotification(
    gameId: string,
    inviterName: string,
  ): CreateNotificationDto {
    return {
      title: 'New Round Invitation',
      body: `${inviterName} invited you to join a round`,
      data: {
        gameId,
        action: 'invite',
      },
      type: NotificationType.GAME,
    };
  }

  createGameReminderNotification(
    gameId: string,
    gameTime: string,
  ): CreateNotificationDto {
    return {
      title: 'Round Reminder',
      body: `Your round starts in 30 minutes at ${gameTime}`,
      data: {
        gameId,
        action: 'reminder',
      },
      type: NotificationType.GAME,
    };
  }

  createGameCancelledNotification(
    gameId: string,
    reason?: string,
  ): CreateNotificationDto {
    return {
      title: 'Round Cancelled',
      body: reason || 'A round you were invited to has been cancelled',
      data: {
        gameId,
        action: 'cancelled',
      },
      type: NotificationType.GAME,
    };
  }

  createNewMessageNotification(
    chatId: string,
    senderName: string,
    messagePreview: string,
  ): CreateNotificationDto {
    return {
      title: `Message from ${senderName}`,
      body:
        messagePreview.length > 50
          ? `${messagePreview.substring(0, 50)}...`
          : messagePreview,
      data: {
        chatId,
        action: 'new_message',
      },
      type: NotificationType.CHAT,
    };
  }

  createNewFollowerNotification(followerName: string): CreateNotificationDto {
    return {
      title: 'New Follower',
      body: `${followerName} started following you`,
      data: {
        action: 'new_follower',
      },
      type: NotificationType.FOLLOW,
    };
  }

  createWelcomeNotification(): CreateNotificationDto {
    return {
      title: 'Welcome to Alba!',
      body: 'Thanks for joining. Start exploring golf courses and connecting with other players.',
      data: {
        action: 'welcome',
      },
      type: NotificationType.GENERAL,
    };
  }

  createJoinRequestNotification(
    gameId: string,
    joinerName: string,
    gameLocation: string,
  ): CreateNotificationDto {
    return {
      title: 'New Join Request',
      body: `${joinerName} wants to join your round at ${gameLocation}`,
      data: {
        gameId,
        action: 'join_request',
      },
      type: NotificationType.GAME,
    };
  }

  createPlayerApprovedNotification(
    gameId: string,
    gameLocation: string,
  ): CreateNotificationDto {
    return {
      title: "You're In!",
      body: `Your request to join the round at ${gameLocation} has been approved`,
      data: {
        gameId,
        action: 'approved',
      },
      type: NotificationType.GAME,
    };
  }

  createPlayerRejectedNotification(
    gameId: string,
    gameLocation: string,
  ): CreateNotificationDto {
    return {
      title: 'Request Declined',
      body: `Your request to join the round at ${gameLocation} was not approved`,
      data: {
        gameId,
        action: 'rejected',
      },
      type: NotificationType.GAME,
    };
  }

  createGameNearbyNotification(
    gameId: string,
    organiser: string,
    gameTitle: string,
    gameDate: string,
  ): CreateNotificationDto {
    return {
      title: 'Game Nearby',
      body: `Fancy joining ${organiser} for the game ${gameTitle} on ${gameDate}?`,
      data: {
        gameId,
        action: 'game_nearby',
        organiser,
        gameTitle,
        gameDate,
      },
      type: NotificationType.GAME,
    };
  }

  /**
   * Weekly digest of new games near a user (sent by the scheduled cron job).
   * One game reads "New game at {course}"; multiple read "{n} new games near
   * you this week". Tagged with GAMES_NEARBY_WEEKLY_ACTION so the job can
   * enforce its one-per-week-per-user limit.
   */
  createGamesNearbyWeeklyNotification(
    nearbyGames: { gameId: string; courseName: string }[],
  ): CreateNotificationDto {
    const count = nearbyGames.length;

    if (count === 1) {
      const { gameId, courseName } = nearbyGames[0];
      return {
        title: 'New Game Nearby',
        body: `New game at ${courseName}`,
        data: {
          action: GAMES_NEARBY_WEEKLY_ACTION,
          gameCount: '1',
          gameId,
          courseName,
        },
        type: NotificationType.GAME,
      };
    }

    return {
      title: 'Games Near You',
      body: `${count} new games near you this week`,
      data: {
        action: GAMES_NEARBY_WEEKLY_ACTION,
        gameCount: count.toString(),
      },
      type: NotificationType.GAME,
    };
  }

  /**
   * "Last call" reminder for a player who still owes for a game happening
   * within the next 24 hours (sent by the scheduled cron job). Tagged with
   * UNPAID_GAME_REMINDER_ACTION so the job can dedupe per game+player.
   */
  createUnpaidGameReminderNotification(
    gameId: string,
    teeTime: string,
    courseName: string,
  ): CreateNotificationDto {
    return {
      title: `Last call — game tomorrow at ${teeTime}`,
      body: `Pay now to keep your spot at ${courseName}.`,
      data: {
        gameId,
        action: UNPAID_GAME_REMINDER_ACTION,
        teeTime,
        courseName,
      },
      type: NotificationType.GAME,
    };
  }

  /**
   * "Playing tomorrow" reminder for a player of a ready game happening within
   * the next 24 hours (sent by the scheduled cron job). Tagged with
   * PLAYING_TOMORROW_ACTION so the job can dedupe per game+player.
   */
  createPlayingTomorrowNotification(
    gameId: string,
    courseName: string,
    teeTime: string,
  ): CreateNotificationDto {
    return {
      title: `Playing tomorrow at ${courseName}`,
      body: `Your tee time is at ${teeTime}. Have a great round!`,
      data: {
        gameId,
        action: PLAYING_TOMORROW_ACTION,
        courseName,
        teeTime,
      },
      type: NotificationType.GAME,
    };
  }

  /**
   * "Under capacity" nudge for the organiser of a game happening within the
   * next 24 hours that still has fewer players than it needs (sent by the
   * scheduled cron job). Tagged with UNDER_CAPACITY_NUDGE_ACTION so the job can
   * dedupe per game.
   */
  createUnderCapacityNudgeNotification(
    gameId: string,
    courseName: string,
    playersCurrent: number,
    playersNeeded: number,
  ): CreateNotificationDto {
    return {
      title: `${courseName} — ${playersCurrent} of ${playersNeeded} in`,
      body: `Drop to a ${playersCurrent}-ball and lock it in. This way the round still happens.`,
      data: {
        gameId,
        action: UNDER_CAPACITY_NUDGE_ACTION,
        playersCurrent: playersCurrent.toString(),
        playersNeeded: playersNeeded.toString(),
        courseName,
      },
      type: NotificationType.GAME,
    };
  }

  /**
   * "Payout on its way" notification sent to the organiser the day after a
   * completed round (sent by the scheduled cron job). Tagged with
   * PAYOUT_ON_ITS_WAY_ACTION so the job can dedupe per game.
   */
  createPayoutOnItsWayNotification(
    gameId: string,
    courseName: string,
  ): CreateNotificationDto {
    return {
      title: 'Your payout is on its way',
      body: `From your round at ${courseName}. In your account in 7–10 days.`,
      data: {
        gameId,
        action: PAYOUT_ON_ITS_WAY_ACTION,
        courseName,
      },
      type: NotificationType.GAME,
    };
  }

  createInvitationAcceptedNotification(
    gameId: string,
    playerName: string,
    gameLocation: string,
  ): CreateNotificationDto {
    return {
      title: 'Invitation Accepted',
      body: `${playerName} accepted your invitation to join the round at ${gameLocation}`,
      data: {
        gameId,
        action: 'invitation_accepted',
      },
      type: NotificationType.GAME,
    };
  }

  createInvitationDeclinedNotification(
    gameId: string,
    playerName: string,
    gameLocation: string,
  ): CreateNotificationDto {
    return {
      title: 'Invitation Declined',
      body: `${playerName} declined your invitation to join the round at ${gameLocation}`,
      data: {
        gameId,
        action: 'invitation_declined',
      },
      type: NotificationType.GAME,
    };
  }

  createGameReadyToBookNotification(
    gameId: string,
    gameLocation: string,
  ): CreateNotificationDto {
    return {
      title: 'Round Ready to Book',
      body: `Your round at ${gameLocation} now has enough players and is ready to be booked`,
      data: {
        gameId,
        action: 'ready_to_book',
      },
      type: NotificationType.GAME,
    };
  }

  createGameConfirmedNotification(
    gameId: string,
    gameLocation: string,
    exactTime?: string,
    gameDate?: Date,
  ): CreateNotificationDto {
    const dateStr = gameDate ? gameDate.toLocaleDateString('en-GB') : '';
    const timeInfo = exactTime ? ` at ${exactTime}` : '';
    const dateInfo = dateStr ? ` on ${dateStr}` : '';

    return {
      title: 'Round Confirmed',
      body: `Your round at ${gameLocation}${timeInfo}${dateInfo} has been confirmed and is ready for payment`,
      data: {
        gameId,
        action: 'confirmed',
        exactTime,
        gameDate: gameDate?.toISOString(),
      },
      type: NotificationType.GAME,
    };
  }

  createGameCompletedNotification(
    gameId: string,
    gameLocation: string,
  ): CreateNotificationDto {
    return {
      title: 'Round Completed',
      body: `Your round at ${gameLocation} has been marked as completed. Hope you had a great round!`,
      data: {
        gameId,
        action: 'completed',
      },
      type: NotificationType.GAME,
    };
  }

  createOrganiserPayoutPendingNotification(
    gameId: string,
    amountPence: number,
    gameLocation: string,
  ): CreateNotificationDto {
    const amountFormatted = (amountPence / 100).toFixed(2);
    return {
      title: 'Round Completed',
      body: `Your round at ${gameLocation} is complete. You will get £${amountFormatted} in your account in 7-10 working days. We'll let you know when it's on the way.`,
      data: {
        gameId,
        action: 'organiser_payout_pending',
        amount: amountPence.toString(),
      },
      type: NotificationType.GAME,
    };
  }

  createPaymentConfirmationNotification(
    gameId: string,
    amount: number,
  ): CreateNotificationDto {
    const amountFormatted = (amount / 100).toFixed(2); // Convert pence to pounds

    return {
      title: 'Payment Confirmed',
      body: `Your payment of £${amountFormatted} for the round has been processed successfully`,
      data: {
        gameId,
        action: 'payment_confirmed',
        amount: amount.toString(),
      },
      type: NotificationType.GAME,
    };
  }

  createAllPlayersPaidNotification(
    gameId: string,
    gameDateFormatted?: string,
  ): CreateNotificationDto {
    const dateSuffix = gameDateFormatted ? ` on ${gameDateFormatted}` : '';

    return {
      title: 'All Players Paid',
      body: `All players have paid for your round${dateSuffix}. You're all set!`,
      data: {
        gameId,
        action: 'all_paid',
        gameDate: gameDateFormatted,
      },
      type: NotificationType.GAME,
    };
  }

  // ===================== CHAT NOTIFICATIONS =====================

  createNewDirectMessageNotification(
    conversationId: string,
    senderName: string,
    messageContent: string,
  ): CreateNotificationDto {
    const preview = this.truncateMessage(messageContent);

    return {
      title: senderName,
      body: preview,
      data: {
        conversationId,
        action: 'new_direct_message',
        type: 'DIRECT',
      },
      type: NotificationType.CHAT,
    };
  }

  createNewGameMessageNotification(
    conversationId: string,
    senderName: string,
    messageContent: string,
    gameName: string,
  ): CreateNotificationDto {
    const preview = this.truncateMessage(messageContent);

    return {
      title: `${senderName} in ${gameName}`,
      body: preview,
      data: {
        conversationId,
        action: 'new_game_message',
        type: 'GAME',
        gameName,
      },
      type: NotificationType.CHAT,
    };
  }

  createNewGroupMessageNotification(
    conversationId: string,
    senderName: string,
    messageContent: string,
    groupName: string,
  ): CreateNotificationDto {
    const preview = this.truncateMessage(messageContent);

    return {
      title: `${senderName} in ${groupName}`,
      body: preview,
      data: {
        conversationId,
        action: 'new_group_message',
        type: 'GROUP',
        groupName,
      },
      type: NotificationType.CHAT,
    };
  }

  createMultipleMessagesNotification(
    conversationId: string,
    senderName: string,
    messageCount: number,
    conversationType: 'DIRECT' | 'GAME' | 'GROUP',
    conversationName?: string,
  ): CreateNotificationDto {
    let title: string;
    let body: string;

    if (conversationType === 'DIRECT') {
      title = senderName;
      body = `${messageCount} new messages`;
    } else {
      const contextName =
        conversationName ||
        (conversationType === 'GAME' ? 'Game Chat' : 'Group Chat');
      title = `${senderName} in ${contextName}`;
      body = `${messageCount} new messages`;
    }

    return {
      title,
      body,
      data: {
        conversationId,
        action: 'multiple_messages',
        type: conversationType,
        messageCount: messageCount.toString(),
        conversationName,
      },
      type: NotificationType.CHAT,
    };
  }

  createAddedToGroupNotification(
    conversationId: string,
    groupName: string,
    addedByName: string,
  ): CreateNotificationDto {
    return {
      title: 'Added to Group',
      body: `${addedByName} added you to ${groupName}`,
      data: {
        conversationId,
        action: 'added_to_group',
        type: 'GROUP',
        groupName,
      },
      type: NotificationType.CHAT,
    };
  }

  createAddedToGameChatNotification(
    conversationId: string,
    gameName: string,
  ): CreateNotificationDto {
    return {
      title: 'Added to Round Chat',
      body: `You can now chat with other players in ${gameName}`,
      data: {
        conversationId,
        action: 'added_to_game_chat',
        type: 'GAME',
        gameName,
      },
      type: NotificationType.CHAT,
    };
  }

  // Helper method to truncate message content for notifications
  private truncateMessage(content: string, maxLength: number = 100): string {
    if (!content) return '';

    // Remove excessive whitespace and newlines
    const cleaned = content.replace(/\s+/g, ' ').trim();

    if (cleaned.length <= maxLength) {
      return cleaned;
    }

    // Find the last complete word within the limit
    const truncated = cleaned.substring(0, maxLength);
    const lastSpaceIndex = truncated.lastIndexOf(' ');

    if (lastSpaceIndex > maxLength * 0.7) {
      // If we can keep most of the message
      return truncated.substring(0, lastSpaceIndex) + '...';
    } else {
      return truncated + '...';
    }
  }

  // ===================== COMPLAINT NOTIFICATIONS =====================

  createNewComplaintNotification(
    complaintId: string,
    complaintType: string,
    gameLocation: string,
    complainantName: string,
  ): CreateNotificationDto {
    const readableType = complaintType.toLowerCase().replace(/_/g, ' ');

    return {
      title: 'New Complaint Filed',
      body: `${complainantName} filed a ${readableType} complaint for the round at ${gameLocation}`,
      data: {
        complaintId,
        action: 'new_complaint',
        complaintType,
      },
      type: NotificationType.GENERAL,
    };
  }

  createComplaintResolvedNotification(
    complaintId: string,
    resolution: string,
    refundAmount?: number,
  ): CreateNotificationDto {
    let body = `Your complaint has been resolved: ${resolution}`;
    if (refundAmount && refundAmount > 0) {
      body += `. A refund of £${(refundAmount / 100).toFixed(2)} has been processed.`;
    }

    return {
      title: 'Complaint Resolved',
      body,
      data: {
        complaintId,
        action: 'complaint_resolved',
        resolution,
        refundAmount: refundAmount?.toString(),
      },
      type: NotificationType.GENERAL,
    };
  }

  createComplaintRejectedNotification(
    complaintId: string,
    reason: string,
  ): CreateNotificationDto {
    return {
      title: 'Complaint Decision',
      body: `Your complaint has been reviewed and rejected: ${reason}`,
      data: {
        complaintId,
        action: 'complaint_rejected',
        reason,
      },
      type: NotificationType.GENERAL,
    };
  }

  createAdminComplaintNotification(
    complaintId: string,
    complaintType: string,
    gameLocation: string,
    complainantName: string,
  ): CreateNotificationDto {
    const readableType = complaintType.toLowerCase().replace(/_/g, ' ');

    return {
      title: 'Admin: New Complaint',
      body: `${complainantName} filed a ${readableType} complaint for round at ${gameLocation}`,
      data: {
        complaintId,
        action: 'admin_new_complaint',
        complaintType,
      },
      type: NotificationType.GENERAL,
    };
  }

  // ===================== STRIPE FINANCIAL NOTIFICATIONS =====================

  createPaymentFailedNotification(
    amount: number,
    gameId?: string,
    reason?: string,
  ): CreateNotificationDto {
    const formattedAmount = `£${(amount / 100).toFixed(2)}`;
    let body = `Your payment of ${formattedAmount} could not be processed`;
    if (reason) {
      body += `. Reason: ${reason}`;
    }
    body += '. Please try again or use a different payment method.';

    return {
      title: 'Payment Failed',
      body,
      data: {
        action: 'payment_failed',
        amount: amount.toString(),
        gameId,
        reason,
      },
      type: NotificationType.GENERAL,
    };
  }

  createPaymentProcessingNotification(
    amount: number,
    gameId?: string,
  ): CreateNotificationDto {
    const formattedAmount = `£${(amount / 100).toFixed(2)}`;

    return {
      title: 'Payment Processing',
      body: `Your payment of ${formattedAmount} is being processed. You'll be notified once it's complete.`,
      data: {
        action: 'payment_processing',
        amount: amount.toString(),
        gameId,
      },
      type: NotificationType.GENERAL,
    };
  }

  createRefundProcessedNotification(
    amount: number,
    gameId?: string,
  ): CreateNotificationDto {
    const formattedAmount = `£${(amount / 100).toFixed(2)}`;

    return {
      title: 'Refund Processed',
      body: `Your refund of ${formattedAmount} has been processed and will appear in your account within 3-5 business days.`,
      data: {
        action: 'refund_processed',
        amount: amount.toString(),
        gameId,
      },
      type: NotificationType.GENERAL,
    };
  }

  createRefundFailedNotification(
    amount: number,
    gameId?: string,
    reason?: string,
  ): CreateNotificationDto {
    const formattedAmount = `£${(amount / 100).toFixed(2)}`;
    let body = `Your refund of ${formattedAmount} could not be processed`;
    if (reason) {
      body += `. Reason: ${reason}`;
    }
    body += '. Please contact support for assistance.';

    return {
      title: 'Refund Failed',
      body,
      data: {
        action: 'refund_failed',
        amount: amount.toString(),
        gameId,
        reason,
      },
      type: NotificationType.GENERAL,
    };
  }

  createPayoutSuccessNotification(
    amount: number,
    gameId?: string,
  ): CreateNotificationDto {
    const formattedAmount = `£${(amount / 100).toFixed(2)}`;

    return {
      title: 'Payout Received',
      body: `You've received a payout of ${formattedAmount} for organizing a round. Funds will arrive in your bank account within 1-3 business days.`,
      data: {
        action: 'payout_success',
        amount: amount.toString(),
        gameId,
      },
      type: NotificationType.GENERAL,
    };
  }

  createPayoutFailedNotification(
    amount: number,
    gameId?: string,
    reason?: string,
  ): CreateNotificationDto {
    const formattedAmount = `£${(amount / 100).toFixed(2)}`;
    let body = `Your payout of ${formattedAmount} could not be processed`;
    if (reason) {
      body += `. Reason: ${reason}`;
    }
    body += '. Please check your bank details or contact support.';

    return {
      title: 'Payout Failed',
      body,
      data: {
        action: 'payout_failed',
        amount: amount.toString(),
        gameId,
        reason,
      },
      type: NotificationType.GENERAL,
    };
  }

  createPaymentReceivedNotification(
    payerName: string,
    gameDateFormatted?: string,
    gameId?: string,
  ): CreateNotificationDto {
    const dateSuffix = gameDateFormatted ? ` on ${gameDateFormatted}` : '';

    return {
      title: 'Payment Received',
      body: `${payerName} has paid for your round${dateSuffix}.`,
      data: {
        action: 'payment_received',
        gameId,
        payerName,
        gameDate: gameDateFormatted,
      },
      type: NotificationType.GENERAL,
    };
  }

  createAccountVerifiedNotification(): CreateNotificationDto {
    return {
      title: 'Account Verified ✅',
      body: "You're now verified for payments! You can organise rounds and receive payouts.",
      data: {
        action: 'account_verified',
      },
      type: NotificationType.GENERAL,
    };
  }

  createAccountIssueNotification(issue?: string): CreateNotificationDto {
    let body = "There's an issue with your Stripe account verification";
    if (issue) {
      body += `: ${issue}`;
    }
    body += '. Please complete your account setup to organize paid rounds.';

    return {
      title: 'Account Verification Needed',
      body,
      data: {
        action: 'account_issue',
        issue,
      },
      type: NotificationType.GENERAL,
    };
  }

  // ===================== FOLLOW/RELATIONSHIP NOTIFICATIONS =====================

  createFollowBackSuggestionNotification(
    userName: string,
    userId: string,
  ): CreateNotificationDto {
    return {
      title: 'Follow Back?',
      body: `${userName} started following you. Follow them back to connect!`,
      data: {
        action: 'follow_back_suggestion',
        userId,
        userName,
      },
      type: NotificationType.FOLLOW,
    };
  }

  createMutualConnectionNotification(
    userName: string,
    userId: string,
  ): CreateNotificationDto {
    return {
      title: 'Connected! 🎉',
      body: `You and ${userName} are now connected on Alba`,
      data: {
        action: 'mutual_connection',
        userId,
        userName,
      },
      type: NotificationType.FOLLOW,
    };
  }
}
