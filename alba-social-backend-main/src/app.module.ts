import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { ProfilesModule } from './profiles/profiles.module';
import { RelationshipsModule } from './relationships/relationships.module';
import { PostsModule } from './posts/posts.module';
import { LeaderboardsModule } from './leaderboards/leaderboards.module';
import { GroupsModule } from './groups/groups.module';
import { CoursesModule } from './courses/courses.module';
import { ConfigModule } from '@nestjs/config';
import { GamesModule } from './games/games.module';
import { AuthModule } from './auth/auth.module';
import { ImagesModule } from './images/images.module';
import { ImageProcessingModule } from './image-processing/image-processing.module';
import { ConversationsModule } from './conversations/conversations.module';
import { MessagesModule } from './messages/messages.module';
import { ChatGateway } from './websockets/chat.gateway';
import { ChatModule } from './websockets/chat.module';
import { LocationsModule } from './locations/locations.module';
import { StripeModule } from './stripe/stripe.module';
import { ComplaintsModule } from './complaints/complaints.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CacheModule } from '@nestjs/cache-manager';
import { ReportsModule } from './reports/reports.module';
import { BlocksModule } from './blocks/blocks.module';
import { AttributionModule } from './attribution/attribution.module';
import { AdminModule } from './admin/admin.module';
import { V1Module } from './v1/v1.module';
import { SentryExceptionFilter } from './shared/sentry.filter';
import { WellKnownController } from './well-known/well-known.controller';
import { RoundController } from './round/round.controller';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    AdminModule,
    ProfilesModule,
    RelationshipsModule,
    PostsModule,
    LeaderboardsModule,
    GroupsModule,
    CoursesModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    GamesModule,
    AuthModule,
    ImagesModule,
    ImageProcessingModule,
    ConversationsModule,
    MessagesModule,
    ChatModule,
    LocationsModule,
    StripeModule,
    ComplaintsModule,
    NotificationsModule,
    CacheModule.register({
      isGlobal: true,
      ttl: 0, // No expiration - cache indefinitely
      max: 100, // Maximum number of items
    }),
    ReportsModule,
    BlocksModule,
    AttributionModule,
    V1Module,
  ],
  controllers: [WellKnownController, RoundController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: SentryExceptionFilter,
    },
  ],
})
export class AppModule {}
