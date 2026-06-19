import { Injectable, Logger } from '@nestjs/common';
import { GameStatus, NotificationType, PlayerStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotificationsService,
  GAMES_NEARBY_WEEKLY_ACTION,
  UNPAID_GAME_REMINDER_ACTION,
  PLAYING_TOMORROW_ACTION,
  UNDER_CAPACITY_NUDGE_ACTION,
  PAYOUT_ON_ITS_WAY_ACTION,
} from '../notifications/notifications.service';

/** Notify users about new games within this radius (km) of a course. */
const NEARBY_RADIUS_KM = 10;
/** Look-ahead window for upcoming games to consider. */
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** Skip a user if they got a games-nearby notification within this window. */
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
/** Look-ahead window for the unpaid "last call" reminder. */
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Hosts the notification jobs that are run on a schedule by an external
 * trigger (Railway cron). Each cron service runs the standalone runner
 * (`scheduled-notifications.runner.ts`) with a job name; the runner resolves
 * this service and calls {@link runJob}.
 *
 * To add a new scheduled notification:
 *   1. Add a private `async someJob()` method below.
 *   2. Register it in the `jobs` map.
 *   3. Create a Railway cron service whose start command passes the job name
 *      (see `CRON.md`).
 */
@Injectable()
export class ScheduledNotificationsService {
  private readonly logger = new Logger(ScheduledNotificationsService.name);

  /**
   * Registry of runnable jobs, keyed by the name passed on the command line.
   * Bind to `this` so the handlers keep their context when invoked from the map.
   */
  private readonly jobs: Record<string, () => Promise<void>> = {
    'games-nearby-weekly': this.gamesNearbyWeeklyJob.bind(this),
    'unpaid-game-reminder': this.unpaidGameReminderJob.bind(this),
    'playing-tomorrow': this.playingTomorrowJob.bind(this),
    'under-capacity-nudge': this.underCapacityNudgeJob.bind(this),
    'payout-on-its-way': this.payoutOnItsWayJob.bind(this),
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Entry point used by the runner. A job name is required; each Railway cron
   * service runs exactly one named job on its own schedule. Throws if the name
   * is unknown so the process exits non-zero and the failure surfaces in
   * Railway / Sentry.
   */
  async runJob(jobName: string): Promise<void> {
    const handler = this.jobs[jobName];
    if (!handler) {
      throw new Error(
        `Unknown scheduled job "${jobName}". Known jobs: ${Object.keys(
          this.jobs,
        ).join(', ')}`,
      );
    }

    const startedAt = Date.now();
    this.logger.log(`Starting scheduled job "${jobName}"`);
    try {
      await handler();
      this.logger.log(
        `Finished scheduled job "${jobName}" in ${Date.now() - startedAt}ms`,
      );
    } catch (error) {
      this.logger.error(
        `Scheduled job "${jobName}" failed after ${Date.now() - startedAt}ms`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * Daily "games near you" notification.
   *
   * For each user with a known location, finds open games happening within the
   * next week whose course is within {@link NEARBY_RADIUS_KM} of the user —
   * excluding games they created or already joined. Skips users who already
   * received a games-nearby notification in the last two days, so a user is
   * notified at most once every two days. One match reads "New game at
   * {course}"; multiple read "{n} new games near you this week".
   *
   * Intended to run daily via Railway cron. `sendNotificationToUser` handles
   * the per-user notification settings, persistence, and push delivery.
   */
  private async gamesNearbyWeeklyJob(): Promise<void> {
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - TWO_DAYS_MS);
    const oneWeekAhead = new Date(now.getTime() + ONE_WEEK_MS);

    // Open games happening within the next week at a locatable course.
    const games = await this.prisma.game.findMany({
      where: {
        deleted_at: null,
        status: GameStatus.PLAYERS_REQUIRED,
        date: { gte: now, lte: oneWeekAhead },
        course: {
          is: { deleted_at: null, lat: { not: null }, lng: { not: null } },
        },
      },
      select: {
        id: true,
        creator_id: true,
        course: { select: { name: true, lat: true, lng: true } },
        players: {
          where: { deleted_at: null },
          select: { user_id: true },
        },
      },
    });

    if (games.length === 0) {
      this.logger.log(
        'games-nearby-weekly: no games in the next week, nothing to do',
      );
      return;
    }

    // Users who already received this notification in the last 2 days are
    // skipped, enforcing the once-per-two-days limit (and guarding re-runs).
    const recentlyNotified = await this.prisma.notification.findMany({
      where: {
        created_at: { gte: twoDaysAgo },
        type: NotificationType.GAME,
        data: { path: ['action'], equals: GAMES_NEARBY_WEEKLY_ACTION },
      },
      select: { user_id: true },
    });
    const alreadyNotified = new Set(recentlyNotified.map((n) => n.user_id));

    const users = await this.prisma.user.findMany({
      where: {
        deleted_at: null,
        latestLocation: { is: { deleted_at: null } },
      },
      select: {
        id: true,
        latestLocation: { select: { lat: true, lng: true } },
      },
    });

    let notifiedCount = 0;
    for (const user of users) {
      if (alreadyNotified.has(user.id)) continue;
      const loc = user.latestLocation;
      if (!loc) continue;

      const nearby = games.filter(
        (game) =>
          game.creator_id !== user.id &&
          !game.players.some((player) => player.user_id === user.id) &&
          this.distanceKm(loc.lat, loc.lng, game.course.lat, game.course.lng) <=
            NEARBY_RADIUS_KM,
      );

      if (nearby.length === 0) continue;

      const payload =
        this.notificationsService.createGamesNearbyWeeklyNotification(
          nearby.map((game) => ({
            gameId: game.id,
            courseName: game.course.name,
          })),
        );
      await this.notificationsService.sendNotificationToUser(user.id, payload);
      notifiedCount += 1;
    }

    this.logger.log(
      `games-nearby-weekly: ${games.length} new game(s) this week, notified ${notifiedCount} user(s)`,
    );
  }

  /**
   * Daily "last call" reminder for unpaid players.
   *
   * Finds games happening within the next 24 hours that have approved players
   * who still owe for their spot (not paid, not refunded) and reminds each of
   * them. Skips a player who was already reminded about the same game in the
   * last 24 hours so re-runs don't double-send.
   *
   * Intended to run daily via Railway cron (same runner as the other jobs).
   * `sendNotificationToUser` handles per-user settings, persistence and push.
   */
  private async unpaidGameReminderJob(): Promise<void> {
    const now = new Date();
    const in24h = new Date(now.getTime() + ONE_DAY_MS);
    const oneDayAgo = new Date(now.getTime() - ONE_DAY_MS);

    // Games happening in the next 24 hours at a known course, with approved
    // players who still owe for their spot.
    const games = await this.prisma.game.findMany({
      where: {
        deleted_at: null,
        status: { notIn: [GameStatus.CANCELLED, GameStatus.COMPLETED] },
        date: { gte: now, lte: in24h },
        exact_time: { not: null },
        course: { is: { deleted_at: null } },
        players: {
          some: {
            deleted_at: null,
            status: PlayerStatus.APPROVED,
            has_paid: false,
            refunded: false,
          },
        },
      },
      select: {
        id: true,
        exact_time: true,
        course: { select: { name: true } },
        players: {
          where: {
            deleted_at: null,
            status: PlayerStatus.APPROVED,
            has_paid: false,
            refunded: false,
          },
          select: { user_id: true },
        },
      },
    });

    if (games.length === 0) {
      this.logger.log(
        'unpaid-game-reminder: no unpaid games in the next 24h, nothing to do',
      );
      return;
    }

    // Players already reminded about a given game in the last 24 hours are
    // skipped, so re-runs on the same day don't double-send. Keyed by
    // `${user_id}:${gameId}`.
    const recentReminders = await this.prisma.notification.findMany({
      where: {
        created_at: { gte: oneDayAgo },
        type: NotificationType.GAME,
        data: { path: ['action'], equals: UNPAID_GAME_REMINDER_ACTION },
      },
      select: { user_id: true, data: true },
    });
    const alreadyReminded = new Set(
      recentReminders.map(
        (n) =>
          `${n.user_id}:${(n.data as { gameId?: string } | null)?.gameId ?? ''}`,
      ),
    );

    let notifiedCount = 0;
    for (const game of games) {
      // Narrow the nullable fields the `where` clause already guaranteed.
      if (!game.exact_time || !game.course) {
        continue;
      }

      const payload =
        this.notificationsService.createUnpaidGameReminderNotification(
          game.id,
          game.exact_time,
          game.course.name,
        );

      for (const player of game.players) {
        if (alreadyReminded.has(`${player.user_id}:${game.id}`)) continue;
        await this.notificationsService.sendNotificationToUser(
          player.user_id,
          payload,
        );
        notifiedCount += 1;
      }
    }

    this.logger.log(
      `unpaid-game-reminder: ${games.length} game(s) in the next 24h, sent ${notifiedCount} reminder(s)`,
    );
  }

  /**
   * Daily "playing tomorrow" reminder.
   *
   * Finds ready games happening within the next 24 hours at a known course and
   * reminds each approved player of their tee time. Skips a player who was
   * already reminded about the same game in the last 24 hours so re-runs don't
   * double-send.
   *
   * Intended to run daily via Railway cron (same runner as the other jobs).
   * `sendNotificationToUser` handles per-user settings, persistence and push.
   */
  private async playingTomorrowJob(): Promise<void> {
    const now = new Date();
    const in24h = new Date(now.getTime() + ONE_DAY_MS);
    const oneDayAgo = new Date(now.getTime() - ONE_DAY_MS);

    // Ready games happening in the next 24 hours at a known course, with their
    // approved players.
    const games = await this.prisma.game.findMany({
      where: {
        deleted_at: null,
        status: GameStatus.READY,
        date: { gte: now, lte: in24h },
        exact_time: { not: null },
        course: { is: { deleted_at: null } },
        players: {
          some: { deleted_at: null, status: PlayerStatus.APPROVED },
        },
      },
      select: {
        id: true,
        exact_time: true,
        course: { select: { name: true } },
        players: {
          where: { deleted_at: null, status: PlayerStatus.APPROVED },
          select: { user_id: true },
        },
      },
    });

    if (games.length === 0) {
      this.logger.log(
        'playing-tomorrow: no ready games in the next 24h, nothing to do',
      );
      return;
    }

    // Players already reminded about a given game in the last 24 hours are
    // skipped, so re-runs on the same day don't double-send. Keyed by
    // `${user_id}:${gameId}`.
    const recentReminders = await this.prisma.notification.findMany({
      where: {
        created_at: { gte: oneDayAgo },
        type: NotificationType.GAME,
        data: { path: ['action'], equals: PLAYING_TOMORROW_ACTION },
      },
      select: { user_id: true, data: true },
    });
    const alreadyReminded = new Set(
      recentReminders.map(
        (n) =>
          `${n.user_id}:${(n.data as { gameId?: string } | null)?.gameId ?? ''}`,
      ),
    );

    let notifiedCount = 0;
    for (const game of games) {
      // Narrow the nullable fields the `where` clause already guaranteed.
      if (!game.exact_time || !game.course) {
        continue;
      }

      const payload =
        this.notificationsService.createPlayingTomorrowNotification(
          game.id,
          game.course.name,
          game.exact_time,
        );

      for (const player of game.players) {
        if (alreadyReminded.has(`${player.user_id}:${game.id}`)) continue;
        await this.notificationsService.sendNotificationToUser(
          player.user_id,
          payload,
        );
        notifiedCount += 1;
      }
    }

    this.logger.log(
      `playing-tomorrow: ${games.length} ready game(s) in the next 24h, sent ${notifiedCount} reminder(s)`,
    );
  }

  /**
   * Daily "under capacity" nudge for organisers.
   *
   * Finds games happening within the next 24 hours that still have fewer
   * players than they need and nudges the organiser to drop to a smaller ball
   * so the round still goes ahead. Skips an organiser already nudged about the
   * same game in the last 24 hours so re-runs don't double-send.
   *
   * Intended to run daily via Railway cron (same runner as the other jobs).
   * `sendNotificationToUser` handles per-user settings, persistence and push.
   */
  private async underCapacityNudgeJob(): Promise<void> {
    const now = new Date();
    const in24h = new Date(now.getTime() + ONE_DAY_MS);
    const oneDayAgo = new Date(now.getTime() - ONE_DAY_MS);

    // Games happening in the next 24 hours at a known course that still have
    // fewer players than they need. The field reference compares the two
    // columns in the database (Prisma 5).
    const games = await this.prisma.game.findMany({
      where: {
        deleted_at: null,
        status: { notIn: [GameStatus.CANCELLED, GameStatus.COMPLETED] },
        date: { gte: now, lte: in24h },
        course: { is: { deleted_at: null } },
        // At least 2 players in — a lone player can't drop to a smaller ball.
        players_current: { gt: 1, lt: this.prisma.game.fields.players_needed },
      },
      select: {
        id: true,
        creator_id: true,
        players_current: true,
        players_needed: true,
        course: { select: { name: true } },
      },
    });

    if (games.length === 0) {
      this.logger.log(
        'under-capacity-nudge: no under-capacity games in the next 24h, nothing to do',
      );
      return;
    }

    // Organisers already nudged about a given game in the last 24 hours are
    // skipped, so re-runs on the same day don't double-send. Keyed by
    // `${user_id}:${gameId}`.
    const recentNudges = await this.prisma.notification.findMany({
      where: {
        created_at: { gte: oneDayAgo },
        type: NotificationType.GAME,
        data: { path: ['action'], equals: UNDER_CAPACITY_NUDGE_ACTION },
      },
      select: { user_id: true, data: true },
    });
    const alreadyNudged = new Set(
      recentNudges.map(
        (n) =>
          `${n.user_id}:${(n.data as { gameId?: string } | null)?.gameId ?? ''}`,
      ),
    );

    let notifiedCount = 0;
    for (const game of games) {
      if (!game.course) continue;
      if (alreadyNudged.has(`${game.creator_id}:${game.id}`)) continue;

      const payload =
        this.notificationsService.createUnderCapacityNudgeNotification(
          game.id,
          game.course.name,
          game.players_current,
          game.players_needed,
        );
      await this.notificationsService.sendNotificationToUser(
        game.creator_id,
        payload,
      );
      notifiedCount += 1;
    }

    this.logger.log(
      `under-capacity-nudge: ${games.length} under-capacity game(s) in the next 24h, nudged ${notifiedCount} organiser(s)`,
    );
  }

  /**
   * Daily "payout on its way" notification for organisers.
   *
   * Sent the day after a completed round: finds COMPLETED games whose round
   * was yesterday (between one and two days ago) at a known course and tells
   * the organiser their payout is coming. Skips an organiser already notified
   * about the same game in the last week so re-runs don't double-send.
   *
   * Intended to run daily via Railway cron (same runner as the other jobs).
   * `sendNotificationToUser` handles per-user settings, persistence and push.
   */
  private async payoutOnItsWayJob(): Promise<void> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - ONE_DAY_MS);
    const twoDaysAgo = new Date(now.getTime() - TWO_DAYS_MS);
    const oneWeekAgo = new Date(now.getTime() - ONE_WEEK_MS);

    // Completed games whose round was yesterday (1–2 days ago) at a known
    // course. The daily cadence plus the per-game dedupe means each organiser
    // is notified once, the day after their round.
    const games = await this.prisma.game.findMany({
      where: {
        deleted_at: null,
        status: GameStatus.COMPLETED,
        date: { gte: twoDaysAgo, lt: oneDayAgo },
        course: { is: { deleted_at: null } },
      },
      select: {
        id: true,
        creator_id: true,
        course: { select: { name: true } },
      },
    });

    if (games.length === 0) {
      this.logger.log(
        'payout-on-its-way: no completed rounds from yesterday, nothing to do',
      );
      return;
    }

    // Organisers already notified about a given game in the last week are
    // skipped, so re-runs don't double-send. Keyed by `${user_id}:${gameId}`.
    const recentPayouts = await this.prisma.notification.findMany({
      where: {
        created_at: { gte: oneWeekAgo },
        type: NotificationType.GAME,
        data: { path: ['action'], equals: PAYOUT_ON_ITS_WAY_ACTION },
      },
      select: { user_id: true, data: true },
    });
    const alreadyNotified = new Set(
      recentPayouts.map(
        (n) =>
          `${n.user_id}:${(n.data as { gameId?: string } | null)?.gameId ?? ''}`,
      ),
    );

    let notifiedCount = 0;
    for (const game of games) {
      if (!game.course) continue;
      if (alreadyNotified.has(`${game.creator_id}:${game.id}`)) continue;

      const payload =
        this.notificationsService.createPayoutOnItsWayNotification(
          game.id,
          game.course.name,
        );
      await this.notificationsService.sendNotificationToUser(
        game.creator_id,
        payload,
      );
      notifiedCount += 1;
    }

    this.logger.log(
      `payout-on-its-way: ${games.length} completed round(s) from yesterday, notified ${notifiedCount} organiser(s)`,
    );
  }

  /**
   * Great-circle distance between two lat/lng points in kilometres (Haversine).
   */
  private distanceKm(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const toRad = (deg: number): number => (deg * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
  }
}
