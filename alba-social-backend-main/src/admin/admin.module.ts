import { Module } from '@nestjs/common';
import { AdminUsersController } from './users/users.controller';
import { AdminCoursesController } from './courses/courses.controller';
import { AdminGamesController } from './games/games.controller';
import { AdminNotificationsController } from './notifications/notifications.controller';
import { AdminDashboardsController } from './dashboards/dashboards.controller';
import { GameAnalyticsController } from './game-analytics/game-analytics.controller';
import { AdminUsersService } from './users/users.service';
import { AdminCoursesService } from './courses/courses.service';
import { AdminGamesService } from './games/games.service';
import { AdminNotificationsService } from './notifications/notifications.service';
import { AdminDashboardsService } from './dashboards/dashboards.service';
import { GameAnalyticsService } from './game-analytics/game-analytics.service';
import { UsersModule } from '../users/users.module';
import { CoursesModule } from '../courses/courses.module';
import { GamesModule } from '../games/games.module';
import { PrismaModule } from '../prisma/prisma.module';
import { FirebaseService } from '../firebase/firebase.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    UsersModule,
    CoursesModule,
    GamesModule,
    PrismaModule,
    NotificationsModule,
  ],
  controllers: [
    AdminUsersController,
    AdminCoursesController,
    AdminGamesController,
    AdminNotificationsController,
    AdminDashboardsController,
    GameAnalyticsController,
  ],
  providers: [
    FirebaseService,
    AdminUsersService,
    AdminCoursesService,
    AdminGamesService,
    AdminNotificationsService,
    AdminDashboardsService,
    GameAnalyticsService,
  ],
})
export class AdminModule {}
