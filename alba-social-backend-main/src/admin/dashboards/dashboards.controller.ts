import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../guards/admin.guard';
import { FirebaseAuthGuard } from '../../guards/firebase-auth.guard';
import { AdminDashboardsService } from './dashboards.service';

@ApiTags('admin')
@Controller('admin/dashboards')
@UseGuards(FirebaseAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminDashboardsController {
  constructor(
    private readonly adminDashboardsService: AdminDashboardsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Dashboard metrics (Admin only)',
    description:
      'Returns high-level metrics for the admin dashboard. "Games last 7/30 days" counts COMPLETED games with a scheduled date within the rolling window up to now. onboardingCompletedCount counts non-deleted users whose UserOnboarding.onboarding_completed is true. A user is considered to have "played" a game when they are APPROVED on a COMPLETED game; "joined" a game means having an APPROVED GamePlayer record (regardless of game status). medianTimeToFirstGameDays is measured from User.created_at to the scheduled date of their earliest played game, over users who have played at least one game. medianTimeToFirstGameDaysAllUsers includes users who have never played by treating their wait as (now - created_at) (right-censored), so the value is an upper bound for never-played users. joinedGameWithin7DaysRate is the share of users who joined an APPROVED GamePlayer roster within 7 days of signup; the denominator is users who signed up at least 7 days ago. repeatPlayRate is the share of played users with two or more played games. repeatWithin30DaysCount is the raw count of played users whose second played game was within 30 days of their first; repeatWithin30DaysRate is that count divided by the number of users whose first played game was at least 30 days ago (so they had a full 30-day window). usersPlayedMultipleLast7Days is the count of distinct users with two or more played games whose game date falls in the last 7 days. averageRoundsPerUser is total played rounds (APPROVED on COMPLETED games) divided by total non-deleted users (so never-played users count as zero); totalRoundsPlayed is the same numerator. usersWith3PlusRoundsCount is the number of non-deleted users with three or more played games; usersWith3PlusRoundsRate is that count divided by totalUserCount. Average players per game, full-game rate, and singlePlayerGameRate are computed over COMPLETED games only; a game is considered full when players_current >= players_needed, and single-player when players_current = 1. Revenue fields (totalAlbaRevenuePence, averageAlbaRevenuePerGamePence, averageAlbaRevenuePerUserPence) are in pence (smallest currency unit) and are computed as SUCCEEDED APPLICATION_FEE amounts minus SUCCEEDED APPLICATION_FEE_REFUND amounts; per-game and per-user averages divide that net total by completedGameCount and totalUserCount respectively (fees are not currently attributed to specific games).',
  })
  getMetrics() {
    return this.adminDashboardsService.getMetrics();
  }

  @Get('trends')
  @ApiOperation({
    summary: 'Weekly trend data (Admin only)',
    description:
      'Returns weekly counts of new users and completed games from the start of 2025 onwards. Weeks are ISO weeks bucketed by date_trunc(\'week\', ...) in the database timezone (Monday-start). gamesCount counts COMPLETED non-deleted games whose scheduled date falls in that week; newUsersCount counts non-deleted users whose created_at falls in that week. Empty weeks are included with zero counts. The current (in-progress) week is included.',
  })
  getWeeklyTrends() {
    return this.adminDashboardsService.getWeeklyTrends();
  }
}
