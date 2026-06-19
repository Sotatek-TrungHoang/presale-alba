import { Injectable } from '@nestjs/common';
import { GameStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type PerUserPlayedRow = {
  user_id: string;
  played_count: bigint;
  first_game_date: Date | null;
  second_game_date: Date | null;
  first_join_date: Date | null;
  created_at: Date;
};

type CompletedGameStatsRow = {
  completed_game_count: bigint;
  avg_players_per_game: number | null;
  full_game_count: bigint;
  single_player_game_count: bigint;
};

type CountRow = { count: bigint };

type AlbaRevenueRow = {
  fee_total: bigint | null;
  refund_total: bigint | null;
};

type WeeklyTrendRow = {
  week_start: Date;
  games_count: bigint;
  new_users_count: bigint;
};

@Injectable()
export class AdminDashboardsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    // Scope all-time metrics to users/games/revenue from this date onwards.
    const cohortStart = new Date('2026-04-01T00:00:00.000Z');

    const [
      usersCreatedLast30Days,
      usersCreatedLast7Days,
      activeUsersLast30Days,
      activeUsersLast7Days,
      gamesLast7Days,
      gamesLast30Days,
      onboardingCompletedCount,
      perUserPlayed,
      completedGameStats,
      usersPlayedMultipleLast7DaysRows,
      albaRevenueRows,
    ] = await Promise.all([
      this.prisma.user.count({
        where: {
          deleted_at: null,
          created_at: { gte: thirtyDaysAgo },
        },
      }),
      this.prisma.user.count({
        where: {
          deleted_at: null,
          created_at: { gte: sevenDaysAgo },
        },
      }),
      this.prisma.user.count({
        where: {
          deleted_at: null,
          last_active_at: { gte: thirtyDaysAgo },
        },
      }),
      this.prisma.user.count({
        where: {
          deleted_at: null,
          last_active_at: { gte: sevenDaysAgo },
        },
      }),
      this.prisma.game.count({
        where: {
          deleted_at: null,
          status: GameStatus.COMPLETED,
          date: { gte: sevenDaysAgo, lte: now },
        },
      }),
      this.prisma.game.count({
        where: {
          deleted_at: null,
          status: GameStatus.COMPLETED,
          date: { gte: thirtyDaysAgo, lte: now },
        },
      }),
      this.prisma.user.count({
        where: {
          deleted_at: null,
          created_at: { gte: cohortStart },
          onboarding: { onboarding_completed: true },
        },
      }),
      this.prisma.$queryRaw<PerUserPlayedRow[]>`
        SELECT
          u.id AS user_id,
          u.created_at AS created_at,
          COUNT(g.id)::bigint AS played_count,
          MIN(g.date) AS first_game_date,
          (ARRAY_AGG(g.date ORDER BY g.date ASC) FILTER (WHERE g.id IS NOT NULL))[2] AS second_game_date,
          MIN(gp.created_at) AS first_join_date
        FROM "User" u
        LEFT JOIN "GamePlayer" gp ON gp.user_id = u.id
          AND gp.status = 'APPROVED'
          AND gp.deleted_at IS NULL
        LEFT JOIN "Game" g ON gp.game_id = g.id
          AND g.status = 'COMPLETED'
          AND g.deleted_at IS NULL
        WHERE u.deleted_at IS NULL
          AND u.created_at >= ${cohortStart}
        GROUP BY u.id, u.created_at
      `,
      this.prisma.$queryRaw<CompletedGameStatsRow[]>`
        SELECT
          COUNT(*)::bigint AS completed_game_count,
          AVG(players_current)::float AS avg_players_per_game,
          COUNT(*) FILTER (WHERE players_current >= players_needed)::bigint AS full_game_count,
          COUNT(*) FILTER (WHERE players_current = 1)::bigint AS single_player_game_count
        FROM "Game"
        WHERE status = 'COMPLETED'
          AND deleted_at IS NULL
          AND date >= ${cohortStart}
      `,
      this.prisma.$queryRaw<CountRow[]>`
        SELECT COUNT(*)::bigint AS count FROM (
          SELECT gp.user_id
          FROM "GamePlayer" gp
          JOIN "Game" g ON gp.game_id = g.id
          JOIN "User" u ON gp.user_id = u.id
          WHERE gp.status = 'APPROVED'
            AND gp.deleted_at IS NULL
            AND g.status = 'COMPLETED'
            AND g.deleted_at IS NULL
            AND g.date >= ${sevenDaysAgo}
            AND g.date <= ${now}
            AND u.deleted_at IS NULL
          GROUP BY gp.user_id
          HAVING COUNT(*) >= 2
        ) sub
      `,
      this.prisma.$queryRaw<AlbaRevenueRow[]>`
        SELECT
          COALESCE(SUM(amount) FILTER (WHERE type = 'APPLICATION_FEE'), 0)::bigint AS fee_total,
          COALESCE(SUM(amount) FILTER (WHERE type = 'APPLICATION_FEE_REFUND'), 0)::bigint AS refund_total
        FROM "Transaction"
        WHERE status = 'SUCCEEDED'
          AND deleted_at IS NULL
          AND type IN ('APPLICATION_FEE', 'APPLICATION_FEE_REFUND')
          AND created_at >= ${cohortStart}
      `,
    ]);

    const totalUserCount = perUserPlayed.length;
    const playedRows = perUserPlayed.filter((r) => r.played_count >= 1n);
    const playedUserCount = playedRows.length;

    const repeatPlayRate =
      playedUserCount === 0
        ? null
        : playedRows.filter((r) => r.played_count >= 2n).length /
          playedUserCount;

    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const repeatWithin30DaysCount = playedRows.filter(
      (r) =>
        r.second_game_date !== null &&
        r.first_game_date !== null &&
        r.second_game_date.getTime() - r.first_game_date.getTime() <=
          thirtyDaysMs,
    ).length;

    const eligibleForRepeat30 = playedRows.filter(
      (r) =>
        r.first_game_date !== null &&
        now.getTime() - r.first_game_date.getTime() >= thirtyDaysMs,
    );
    const repeatWithin30DaysRate =
      eligibleForRepeat30.length === 0
        ? null
        : eligibleForRepeat30.filter(
            (r) =>
              r.second_game_date !== null &&
              r.second_game_date.getTime() - r.first_game_date!.getTime() <=
                thirtyDaysMs,
          ).length / eligibleForRepeat30.length;

    const sortedTimeToFirstGameMs = playedRows
      .map((r) => r.first_game_date!.getTime() - r.created_at.getTime())
      .sort((a, b) => a - b);

    const medianAllUsersMs = median(sortedTimeToFirstGameMs);
    const medianTimeToFirstGameDaysAllUsers =
      medianAllUsersMs === null
        ? null
        : medianAllUsersMs / (1000 * 60 * 60 * 24);

    const nowMs = now.getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const eligibleFor7DayJoin = perUserPlayed.filter(
      (r) => nowMs - r.created_at.getTime() >= sevenDaysMs,
    );
    const joinedWithin7DaysCount = eligibleFor7DayJoin.filter(
      (r) =>
        r.first_join_date !== null &&
        r.first_join_date.getTime() - r.created_at.getTime() <= sevenDaysMs,
    ).length;
    const joinedGameWithin7DaysRate =
      eligibleFor7DayJoin.length === 0
        ? null
        : joinedWithin7DaysCount / eligibleFor7DayJoin.length;

    const totalRoundsPlayed = perUserPlayed.reduce(
      (sum, r) => sum + Number(r.played_count),
      0,
    );
    const averageRoundsPerUser =
      totalUserCount === 0 ? null : totalRoundsPlayed / totalUserCount;

    const usersWith3PlusRoundsCount = perUserPlayed.filter(
      (r) => r.played_count >= 3n,
    ).length;
    const usersWith3PlusRoundsRate =
      totalUserCount === 0 ? null : usersWith3PlusRoundsCount / totalUserCount;

    const usersPlayedMultipleLast7Days = Number(
      usersPlayedMultipleLast7DaysRows[0].count,
    );

    const albaRevenueRow = albaRevenueRows[0];
    const totalAlbaRevenuePence =
      Number(albaRevenueRow.fee_total ?? 0n) -
      Number(albaRevenueRow.refund_total ?? 0n);

    const gameStats = completedGameStats[0];
    const completedGameCount = Number(gameStats.completed_game_count);
    const averagePlayersPerGame = gameStats.avg_players_per_game;
    const fullGameRate =
      completedGameCount === 0
        ? null
        : Number(gameStats.full_game_count) / completedGameCount;
    const singlePlayerGameRate =
      completedGameCount === 0
        ? null
        : Number(gameStats.single_player_game_count) / completedGameCount;
    const averageAlbaRevenuePerGamePence =
      completedGameCount === 0
        ? null
        : totalAlbaRevenuePence / completedGameCount;
    const averageAlbaRevenuePerUserPence =
      totalUserCount === 0 ? null : totalAlbaRevenuePence / totalUserCount;

    return {
      usersCreatedLast30Days,
      usersCreatedLast7Days,
      activeUsersLast30Days,
      activeUsersLast7Days,
      gamesLast7Days,
      gamesLast30Days,
      onboardingCompletedCount,
      medianTimeToFirstGameDaysAllUsers,
      joinedGameWithin7DaysRate,
      joinedWithin7DaysCount,
      repeatPlayRate,
      repeatWithin30DaysCount,
      repeatWithin30DaysRate,
      usersPlayedMultipleLast7Days,
      averagePlayersPerGame,
      fullGameRate,
      singlePlayerGameRate,
      averageRoundsPerUser,
      totalRoundsPlayed,
      usersWith3PlusRoundsCount,
      usersWith3PlusRoundsRate,
      totalAlbaRevenuePence,
      averageAlbaRevenuePerGamePence,
      averageAlbaRevenuePerUserPence,
      playedUserCount,
      totalUserCount,
      completedGameCount,
    };
  }

  async getWeeklyTrends() {
    const rows = await this.prisma.$queryRaw<WeeklyTrendRow[]>`
      WITH weeks AS (
        SELECT generate_series(
          date_trunc('week', TIMESTAMPTZ '2026-04-01'),
          date_trunc('week', NOW()),
          INTERVAL '1 week'
        ) AS week_start
      ),
      games_per_week AS (
        SELECT date_trunc('week', date) AS week_start, COUNT(*)::bigint AS games_count
        FROM "Game"
        WHERE status = 'COMPLETED'
          AND deleted_at IS NULL
          AND date >= date_trunc('week', TIMESTAMPTZ '2026-04-01')
        GROUP BY date_trunc('week', date)
      ),
      users_per_week AS (
        SELECT date_trunc('week', created_at) AS week_start, COUNT(*)::bigint AS new_users_count
        FROM "User"
        WHERE deleted_at IS NULL
          AND created_at >= date_trunc('week', TIMESTAMPTZ '2026-04-01')
        GROUP BY date_trunc('week', created_at)
      )
      SELECT
        w.week_start,
        COALESCE(g.games_count, 0)::bigint AS games_count,
        COALESCE(u.new_users_count, 0)::bigint AS new_users_count
      FROM weeks w
      LEFT JOIN games_per_week g ON g.week_start = w.week_start
      LEFT JOIN users_per_week u ON u.week_start = w.week_start
      ORDER BY w.week_start
    `;

    return {
      weeks: rows.map((r) => ({
        weekStart: r.week_start,
        gamesCount: Number(r.games_count),
        newUsersCount: Number(r.new_users_count),
      })),
    };
  }
}

function median(sortedValues: number[]): number | null {
  if (sortedValues.length === 0) return null;
  const mid = Math.floor(sortedValues.length / 2);
  return sortedValues.length % 2 === 0
    ? (sortedValues[mid - 1] + sortedValues[mid]) / 2
    : sortedValues[mid];
}
