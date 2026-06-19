import {
  Controller,
  Get,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AdminGuard } from '../../guards/admin.guard';
import { FirebaseAuthGuard } from '../../guards/firebase-auth.guard';
import { GetGameAnalyticsQueryDto } from './dto/get-game-analytics-query.dto';
import { GameAnalyticsService } from './game-analytics.service';

@ApiTags('admin')
@Controller('admin/game-analytics')
@UseGuards(FirebaseAuthGuard, AdminGuard)
@ApiBearerAuth()
export class GameAnalyticsController {
  constructor(private readonly gameAnalyticsService: GameAnalyticsService) {}

  @Get()
  @ApiOperation({
    summary: 'Game analytics (Admin only)',
    description:
      'Returns headline game-engagement metrics for the analytics dashboard. The comparison window length is controlled by the `days` query param (defaults to 30, also accepts 7, 90, or "all" for an all-time view with no comparison period). Headline metrics (pool, activation, frequency, retention, liquidity) compare a rolling "value" window (the last `days` days up to now) against a "previous" window (the `days` days immediately before that). A user is considered to have "played" a game when they are APPROVED on a COMPLETED game; "joined" means having an APPROVED GamePlayer record (regardless of game status). pool is the count of distinct users who played a game whose scheduled date falls in the window. frequency is the count of COMPLETED games whose scheduled date falls in the window. activation is the share of users who signed up in the window and have since played at least one game (formatted as a rounded percentage string). liquidity is the share of COMPLETED games in the window that filled to their original target (players_current >= initial_players_needed, the players_needed value recorded at creation and never edited thereafter). retention is the share of first-time players whose second played game came within one window (`days`) of their first; its cohort windows are shifted back one window (value = first game 1-2 windows ago, previous = 2-3 windows ago) so every player has had a full window to return. funnel is a conversion funnel for the cohort of users who signed up within the window: Signed up (non-deleted users created in the window), Joined a game (those who have an APPROVED GamePlayer record), Played a game (those APPROVED on a COMPLETED game), Played 2nd game (those with two or more played games); the later stages count actions taken at any time by that signup cohort. For the all-time view (days = all) the cohort is all users. trajectoryWeekly covers the last 12 ISO weeks (Monday-start, including the in-progress week), labelled by ISO week number (e.g. "W19"), with newSignups (users created that week), gamesPlayed (COMPLETED games dated that week), and repeatPlayers (distinct users who played that week after having already played an earlier game). upcoming covers future, non-deleted games that are not CANCELLED or COMPLETED: games (count), players (sum of players_current), fullCount (games where players_current >= players_needed), and fullTotal (total upcoming games). trajectoryWeekly and upcoming are not affected by `days`.',
  })
  @ApiQuery({
    name: 'days',
    required: false,
    enum: [7, 30, 90, 'all'],
    description:
      'Comparison window length in days. Defaults to 30. Use "all" for an all-time view, which spans all data with no comparison period (every "previous" value is 0 and the inner retention/activation windows are unbounded).',
  })
  @ApiQuery({
    name: 'courseId',
    required: false,
    type: String,
    description:
      'Optional golf course id. When provided, every game-based metric is scoped to games played at that course, and every user-based metric (funnel, activation, retention cohorts, weekly signups/repeat players) is scoped to users whose latest known location is within 10km of the course.',
  })
  getAnalytics(
    @Query(new ValidationPipe({ transform: true }))
    query: GetGameAnalyticsQueryDto,
  ) {
    return this.gameAnalyticsService.getAnalytics(query.days, query.courseId);
  }
}
