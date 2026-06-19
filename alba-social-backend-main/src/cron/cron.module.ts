import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsService } from '../notifications/notifications.service';
import { PushNotificationService } from '../notifications/push-notification.service';
import { ScheduledNotificationsService } from './scheduled-notifications.service';

/**
 * Lightweight module bootstrapped by the standalone cron runner.
 *
 * It deliberately does NOT import `NotificationsModule`: that module bundles the
 * notifications controller, which depends on the Firebase auth guard and so
 * pulls in `FirebaseModule`. The cron never authenticates requests, so we
 * provide only the two services the jobs actually need —
 * `NotificationsService` (depends on Prisma + PushNotificationService) and
 * `PushNotificationService` (no dependencies). This keeps the cron process free
 * of any Firebase dependency, so it boots without FIREBASE_* env vars.
 */
@Module({
  imports: [PrismaModule],
  providers: [
    ScheduledNotificationsService,
    NotificationsService,
    PushNotificationService,
  ],
})
export class CronModule {}
