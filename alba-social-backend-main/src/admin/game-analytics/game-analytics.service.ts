import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type PoolRow = { pool_value: bigint; pool_previous: bigint };

type FrequencyRow = { freq_value: bigint; freq_previous: bigint };

type ActivationRow = {
  signups_value: bigint;
  activated_value: bigint;
  signups_previous: bigint;
  activated_previous: bigint;
};

type RetentionRow = {
  cohort_value: bigint;
  retained_value: bigint;
  cohort_previous: bigint;
  retained_previous: bigint;
};

type LiquidityRow = {
  total_value: bigint;
  full_value: bigint;
  total_previous: bigint;
  full_previous: bigint;
};

type FunnelRow = {
  signed_up: bigint;
  joined: bigint;
  played: bigint;
  played_second: bigint;
};

type TrajectoryRow = {
  week_start: Date;
  new_signups: bigint;
  games_played: bigint;
  repeat_players: bigint;
};

type UpcomingRow = {
  games: bigint;
  players: bigint;
  full_count: bigint;
  full_total: bigint;
};

@Injectable()
export class GameAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAnalytics(days: 7 | 30 | 90 | 'all' = 30, courseId?: string) {
    const dayMs = 24 * 60 * 60 * 1000;
    const now = new Date();
    // The "all time" view has no comparison period: every "value" metric spans
    // all data up to now, every "previous" metric is zero, and the inner
    // return/activation windows are unbounded.
    const allTime = days === 'all';
    const windowDays = allTime ? 0 : days;
    // Window boundaries: d1 = one window ago (start of "value"),
    // d2 = two windows ago (start of "previous"), d3 = three windows ago
    // (used to give the previous retention cohort a full return window).
    // Unused (and collapsed to `now`) when allTime is true.
    const d1 = new Date(now.getTime() - windowDays * dayMs);
    const d2 = new Date(now.getTime() - 2 * windowDays * dayMs);
    const d3 = new Date(now.getTime() - 3 * windowDays * dayMs);

    // Optional course scope. When a courseId is supplied, every metric that
    // counts games is restricted to games at that course. `gCourse` targets a
    // query that aliases the Game table as `g`; `gameCourse` targets one that
    // references the unaliased "Game" table directly. Both are empty (no-op)
    // when no courseId is supplied.
    const gCourse = courseId
      ? Prisma.sql`AND g.course_id = ${courseId}`
      : Prisma.empty;
    const gameCourse = courseId
      ? Prisma.sql`AND "Game".course_id = ${courseId}`
      : Prisma.empty;
    // For the funnel "joined" metric, which otherwise never touches the Game
    // table: when scoping to a course we join Game so the count reflects users
    // who joined a game at that course.
    const joinedCourseJoin = courseId
      ? Prisma.sql`JOIN "Game" g ON gp.game_id = g.id`
      : Prisma.empty;

    // When a courseId is supplied we also scope every user-based metric to
    // users whose latest known location is within 10km of the course, using
    // the same Haversine formula (R = 6371km) used elsewhere in the app.
    // `nearCourse(alias)` returns an EXISTS condition for the user referenced
    // by `<alias>.id`; it is a no-op when no course is given or the course has
    // no coordinates on record.
    const course = courseId
      ? await this.prisma.golfCourse.findUnique({
          where: { id: courseId },
          select: { lat: true, lng: true },
        })
      : null;
    const EARTH_RADIUS_KM = 6371;
    const RADIUS_KM = 10;
    const nearCourse = (userAlias: string) =>
      course?.lat != null && course?.lng != null
        ? Prisma.sql`AND EXISTS (
            SELECT 1 FROM "UserLocation" ul
            WHERE ul.user_id = ${Prisma.raw(userAlias)}.id
              AND ul.deleted_at IS NULL
              AND ${EARTH_RADIUS_KM} * acos(LEAST(1, GREATEST(-1,
                cos(radians(${course.lat})) * cos(radians(ul.lat)) *
                  cos(radians(ul.lng) - radians(${course.lng})) +
                sin(radians(${course.lat})) * sin(radians(ul.lat))
              ))) <= ${RADIUS_KM}
          )`
        : Prisma.empty;

    // Per-metric window fragments. For a fixed window the "value" predicate
    // covers the last `days` days and "previous" the `days` before that; for the
    // all-time view "value" is unconditional and "previous" matches nothing.
    // `col` is a trusted, hard-coded column reference (e.g. 'g.date').
    const valueByDate = (col: string) =>
      allTime
        ? Prisma.sql`TRUE`
        : Prisma.sql`${Prisma.raw(col)} >= ${d1} AND ${Prisma.raw(col)} <= ${now}`;
    const prevByDate = (col: string) =>
      allTime
        ? Prisma.sql`FALSE`
        : Prisma.sql`${Prisma.raw(col)} >= ${d2} AND ${Prisma.raw(col)} < ${d1}`;
    // Limits the rows scanned to the two windows under comparison (no-op for all-time).
    const dateScan = (col: string) =>
      allTime
        ? Prisma.empty
        : Prisma.sql`AND ${Prisma.raw(col)} >= ${d2} AND ${Prisma.raw(col)} <= ${now}`;
    // Inner "return" window for retention (2nd game within `days` of the 1st);
    // unbounded for all-time.
    const retentionReturnWindow = allTime
      ? Prisma.sql`second_date IS NOT NULL`
      : Prisma.sql`second_date IS NOT NULL AND second_date <= first_date + ${windowDays} * INTERVAL '1 day'`;
    // Retention cohorts are shifted back one window so every player has had a
    // full window to return: value = first game 1-2 windows ago, previous = 2-3.
    const retentionValue = allTime
      ? Prisma.sql`TRUE`
      : Prisma.sql`first_date >= ${d2} AND first_date < ${d1}`;
    const retentionPrev = allTime
      ? Prisma.sql`FALSE`
      : Prisma.sql`first_date >= ${d3} AND first_date < ${d2}`;
    // Inner "activation" window (played within `days` of signing up); unbounded
    // for all-time.
    const activationPlayedWindow = allTime
      ? Prisma.empty
      : Prisma.sql`AND g.date <= u.created_at + ${windowDays} * INTERVAL '1 day'`;

    const [
      poolRows,
      frequencyRows,
      activationRows,
      retentionRows,
      liquidityRows,
      funnelRows,
      trajectoryRows,
      upcomingRows,
    ] = await Promise.all([
      // Distinct players who played a COMPLETED game in the window.
      this.prisma.$queryRaw<PoolRow[]>`
        SELECT
          COUNT(DISTINCT gp.user_id) FILTER (WHERE ${valueByDate('g.date')})::bigint AS pool_value,
          COUNT(DISTINCT gp.user_id) FILTER (WHERE ${prevByDate('g.date')})::bigint AS pool_previous
        FROM "GamePlayer" gp
        JOIN "Game" g ON gp.game_id = g.id
        JOIN "User" u ON gp.user_id = u.id
        WHERE gp.status = 'APPROVED'
          AND gp.deleted_at IS NULL
          AND g.status = 'COMPLETED'
          AND g.deleted_at IS NULL
          AND u.deleted_at IS NULL
          ${dateScan('g.date')}
          ${gCourse}
          ${nearCourse('u')}
      `,
      // Count of COMPLETED games in the window.
      this.prisma.$queryRaw<FrequencyRow[]>`
        SELECT
          COUNT(*) FILTER (WHERE ${valueByDate('date')})::bigint AS freq_value,
          COUNT(*) FILTER (WHERE ${prevByDate('date')})::bigint AS freq_previous
        FROM "Game"
        WHERE status = 'COMPLETED'
          AND deleted_at IS NULL
          ${dateScan('date')}
          ${gameCourse}
      `,
      // Share of users who signed up in the window and went on to play a game
      // within one window (`days`) of signing up.
      this.prisma.$queryRaw<ActivationRow[]>`
        WITH signups AS (
          SELECT
            u.id,
            u.created_at,
            EXISTS (
              SELECT 1
              FROM "GamePlayer" gp
              JOIN "Game" g ON gp.game_id = g.id
              WHERE gp.user_id = u.id
                AND gp.status = 'APPROVED'
                AND gp.deleted_at IS NULL
                AND g.status = 'COMPLETED'
                AND g.deleted_at IS NULL
                ${activationPlayedWindow}
                ${gCourse}
            ) AS played
          FROM "User" u
          WHERE u.deleted_at IS NULL
            ${dateScan('u.created_at')}
            ${nearCourse('u')}
        )
        SELECT
          COUNT(*) FILTER (WHERE ${valueByDate('created_at')})::bigint AS signups_value,
          COUNT(*) FILTER (WHERE ${valueByDate('created_at')} AND played)::bigint AS activated_value,
          COUNT(*) FILTER (WHERE ${prevByDate('created_at')})::bigint AS signups_previous,
          COUNT(*) FILTER (WHERE ${prevByDate('created_at')} AND played)::bigint AS activated_previous
        FROM signups
      `,
      // Share of first-time players whose 2nd game came within one window of their
      // first. Cohorts are shifted back one window so every player has had a full
      // window to return.
      this.prisma.$queryRaw<RetentionRow[]>`
        WITH first_games AS (
          SELECT
            gp.user_id,
            MIN(g.date) AS first_date,
            (ARRAY_AGG(g.date ORDER BY g.date ASC))[2] AS second_date
          FROM "GamePlayer" gp
          JOIN "Game" g ON gp.game_id = g.id
          JOIN "User" u ON gp.user_id = u.id
          WHERE gp.status = 'APPROVED'
            AND gp.deleted_at IS NULL
            AND g.status = 'COMPLETED'
            AND g.deleted_at IS NULL
            AND u.deleted_at IS NULL
            ${gCourse}
            ${nearCourse('u')}
          GROUP BY gp.user_id
        )
        SELECT
          COUNT(*) FILTER (WHERE ${retentionValue})::bigint AS cohort_value,
          COUNT(*) FILTER (WHERE ${retentionValue} AND ${retentionReturnWindow})::bigint AS retained_value,
          COUNT(*) FILTER (WHERE ${retentionPrev})::bigint AS cohort_previous,
          COUNT(*) FILTER (WHERE ${retentionPrev} AND ${retentionReturnWindow})::bigint AS retained_previous
        FROM first_games
      `,
      // Share of COMPLETED games in the window that filled to their original
      // target (players_current >= initial_players_needed). Using the uneditable
      // initial target means a later reduction in players_needed cannot inflate
      // the fill rate.
      this.prisma.$queryRaw<LiquidityRow[]>`
        SELECT
          COUNT(*) FILTER (WHERE ${valueByDate('date')})::bigint AS total_value,
          COUNT(*) FILTER (WHERE ${valueByDate('date')} AND players_current >= initial_players_needed)::bigint AS full_value,
          COUNT(*) FILTER (WHERE ${prevByDate('date')})::bigint AS total_previous,
          COUNT(*) FILTER (WHERE ${prevByDate('date')} AND players_current >= initial_players_needed)::bigint AS full_previous
        FROM "Game"
        WHERE status = 'COMPLETED'
          AND deleted_at IS NULL
          ${dateScan('date')}
          ${gameCourse}
      `,
      // Conversion funnel for the cohort of users who signed up in the window:
      // of those signups, how many went on to join / play / play a 2nd game (at
      // any time). The cohort is scoped by signup date via valueByDate, so for
      // the all-time view (where valueByDate is TRUE) it covers all users.
      this.prisma.$queryRaw<FunnelRow[]>`
        SELECT
          (SELECT COUNT(*) FROM "User" u WHERE u.deleted_at IS NULL AND ${valueByDate('u.created_at')} ${nearCourse('u')})::bigint AS signed_up,
          (SELECT COUNT(DISTINCT gp.user_id) FROM "GamePlayer" gp ${joinedCourseJoin} JOIN "User" u ON gp.user_id = u.id WHERE gp.status = 'APPROVED' AND gp.deleted_at IS NULL AND u.deleted_at IS NULL AND ${valueByDate('u.created_at')} ${gCourse} ${nearCourse('u')})::bigint AS joined,
          (SELECT COUNT(DISTINCT gp.user_id) FROM "GamePlayer" gp JOIN "Game" g ON gp.game_id = g.id JOIN "User" u ON gp.user_id = u.id WHERE gp.status = 'APPROVED' AND gp.deleted_at IS NULL AND g.status = 'COMPLETED' AND g.deleted_at IS NULL AND u.deleted_at IS NULL AND ${valueByDate('u.created_at')} ${gCourse} ${nearCourse('u')})::bigint AS played,
          (SELECT COUNT(*) FROM (
            SELECT gp.user_id
            FROM "GamePlayer" gp
            JOIN "Game" g ON gp.game_id = g.id
            JOIN "User" u ON gp.user_id = u.id
            WHERE gp.status = 'APPROVED' AND gp.deleted_at IS NULL AND g.status = 'COMPLETED' AND g.deleted_at IS NULL AND u.deleted_at IS NULL AND ${valueByDate('u.created_at')} ${gCourse} ${nearCourse('u')}
            GROUP BY gp.user_id
            HAVING COUNT(*) >= 2
          ) s)::bigint AS played_second
      `,
      // Last 12 ISO weeks of new signups, games played, and repeat players.
      this.prisma.$queryRaw<TrajectoryRow[]>`
        WITH weeks AS (
          SELECT generate_series(
            date_trunc('week', NOW()) - INTERVAL '11 weeks',
            date_trunc('week', NOW()),
            INTERVAL '1 week'
          ) AS week_start
        ),
        signups AS (
          SELECT date_trunc('week', created_at) AS week_start, COUNT(*)::bigint AS c
          FROM "User"
          WHERE deleted_at IS NULL
          ${nearCourse('"User"')}
          GROUP BY 1
        ),
        games AS (
          SELECT date_trunc('week', date) AS week_start, COUNT(*)::bigint AS c
          FROM "Game"
          WHERE status = 'COMPLETED' AND deleted_at IS NULL
          ${gameCourse}
          GROUP BY 1
        ),
        player_games AS (
          SELECT
            gp.user_id,
            g.date,
            MIN(g.date) OVER (PARTITION BY gp.user_id) AS first_date
          FROM "GamePlayer" gp
          JOIN "Game" g ON gp.game_id = g.id
          JOIN "User" u ON gp.user_id = u.id
          WHERE gp.status = 'APPROVED' AND gp.deleted_at IS NULL
            AND g.status = 'COMPLETED' AND g.deleted_at IS NULL
            AND u.deleted_at IS NULL
            ${gCourse}
            ${nearCourse('u')}
        ),
        repeats AS (
          SELECT date_trunc('week', date) AS week_start, COUNT(DISTINCT user_id)::bigint AS c
          FROM player_games
          WHERE date > first_date
          GROUP BY 1
        )
        SELECT
          w.week_start,
          COALESCE(s.c, 0)::bigint AS new_signups,
          COALESCE(gm.c, 0)::bigint AS games_played,
          COALESCE(r.c, 0)::bigint AS repeat_players
        FROM weeks w
        LEFT JOIN signups s ON s.week_start = w.week_start
        LEFT JOIN games gm ON gm.week_start = w.week_start
        LEFT JOIN repeats r ON r.week_start = w.week_start
        ORDER BY w.week_start
      `,
      // Upcoming (future, not cancelled/completed) games.
      this.prisma.$queryRaw<UpcomingRow[]>`
        SELECT
          COUNT(*)::bigint AS games,
          COALESCE(SUM(players_current), 0)::bigint AS players,
          COUNT(*) FILTER (WHERE players_current >= players_needed)::bigint AS full_count,
          COUNT(*)::bigint AS full_total
        FROM "Game"
        WHERE deleted_at IS NULL
          AND status NOT IN ('CANCELLED', 'COMPLETED')
          AND date > ${now}
          ${gameCourse}
      `,
    ]);

    const pool = poolRows[0];
    const frequency = frequencyRows[0];
    const activation = activationRows[0];
    const retention = retentionRows[0];
    const liquidity = liquidityRows[0];
    const funnel = funnelRows[0];
    const upcoming = upcomingRows[0];

    return {
      pool: {
        value: Number(pool.pool_value),
        previous: Number(pool.pool_previous),
      },
      activation: {
        value: pct(activation.activated_value, activation.signups_value),
        previous: pct(
          activation.activated_previous,
          activation.signups_previous,
        ),
      },
      frequency: {
        value: Number(frequency.freq_value),
        previous: Number(frequency.freq_previous),
      },
      retention: {
        value: pct(retention.retained_value, retention.cohort_value),
        previous: pct(retention.retained_previous, retention.cohort_previous),
      },
      liquidity: {
        value: pct(liquidity.full_value, liquidity.total_value),
        previous: pct(liquidity.full_previous, liquidity.total_previous),
      },
      funnel: [
        { label: 'Signed up', count: Number(funnel.signed_up) },
        { label: 'Joined a game', count: Number(funnel.joined) },
        { label: 'Played a game', count: Number(funnel.played) },
        { label: 'Played 2nd game', count: Number(funnel.played_second) },
      ],
      trajectoryWeekly: trajectoryRows.map((r) => ({
        x: formatDayMonth(r.week_start),
        newSignups: Number(r.new_signups),
        gamesPlayed: Number(r.games_played),
        repeatPlayers: Number(r.repeat_players),
      })),
      upcoming: {
        games: Number(upcoming.games),
        players: Number(upcoming.players),
        fullCount: Number(upcoming.full_count),
        fullTotal: Number(upcoming.full_total),
      },
    };
  }
}

function pct(numerator: bigint, denominator: bigint): string {
  if (denominator === 0n) return '0%';
  return `${Math.round((Number(numerator) / Number(denominator)) * 100)}%`;
}

function formatDayMonth(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}
