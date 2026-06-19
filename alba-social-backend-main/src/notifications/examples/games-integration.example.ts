import { Injectable } from '@nestjs/common';
import { NotificationsService } from '../notifications.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Example integration with Games module
 * Add these methods to your GamesService
 *
 * To use this:
 * 1. Inject NotificationsService into your GamesService
 * 2. Copy these methods into your GamesService
 * 3. Call them at appropriate times in your game flow
 */
@Injectable()
export class GamesNotificationIntegration {
  constructor(
    private notificationsService: NotificationsService,
    private prisma: PrismaService,
  ) {}

  /**
   * Send game invitation notification
   * Call this when a user invites another user to a game
   */
  async sendGameInvitation(
    gameId: string,
    inviterId: string,
    invitedUserId: string,
  ) {
    // Get inviter's name
    const inviter = await this.prisma.user.findUnique({
      where: { id: inviterId },
      include: { profile: true },
    });

    if (!inviter) return;

    const notification = this.notificationsService.createGameInviteNotification(
      gameId,
      inviter.profile?.first_name || 'Someone',
    );

    await this.notificationsService.sendNotificationToUser(
      invitedUserId,
      notification,
    );
  }

  /**
   * Send game reminder notification
   * Call this 30 minutes before the game starts (use a cron job)
   */
  async sendGameReminder(gameId: string, gameTime: string) {
    // Get all players in the game
    const gamePlayers = await this.prisma.gamePlayer.findMany({
      where: {
        game_id: gameId,
        status: 'APPROVED',
        deleted_at: null,
      },
    });

    const notification =
      this.notificationsService.createGameReminderNotification(
        gameId,
        gameTime,
      );

    for (const player of gamePlayers) {
      await this.notificationsService.sendNotificationToUser(
        player.user_id,
        notification,
      );
    }
  }

  /**
   * Send game cancellation notification
   * Call this when a game is cancelled
   */
  async sendGameCancellation(gameId: string, reason?: string) {
    // Get all players in the game
    const gamePlayers = await this.prisma.gamePlayer.findMany({
      where: {
        game_id: gameId,
        deleted_at: null,
      },
    });

    const notification =
      this.notificationsService.createGameCancelledNotification(gameId, reason);

    for (const player of gamePlayers) {
      await this.notificationsService.sendNotificationToUser(
        player.user_id,
        notification,
      );
    }
  }

  /**
   * Send notification when a player joins a game
   * Call this when a player successfully joins a game
   */
  async sendPlayerJoinedNotification(gameId: string, joinedPlayerId: string) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        creator: {
          include: { profile: true },
        },
      },
    });

    const joinedPlayer = await this.prisma.user.findUnique({
      where: { id: joinedPlayerId },
      include: { profile: true },
    });

    if (!game || !joinedPlayer) return;

    const notification = {
      title: 'New Player Joined',
      body: `${joinedPlayer.profile?.first_name || 'Someone'} joined your game`,
      data: {
        gameId,
        action: 'player_joined',
        playerId: joinedPlayerId,
      },
      type: 'GAME' as const,
    };

    await this.notificationsService.sendNotificationToUser(
      game.creator_id,
      notification,
    );
  }
}
