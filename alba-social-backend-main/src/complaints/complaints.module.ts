import { Module } from '@nestjs/common';
import { ComplaintsService } from './complaints.service';
import { ComplaintsController } from './complaints.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { StripeModule } from '../stripe/stripe.module';
import { StripeService } from '../stripe/stripe.service';
import { FirebaseService } from '../firebase/firebase.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, StripeModule, NotificationsModule],
  controllers: [ComplaintsController],
  providers: [ComplaintsService, StripeService, FirebaseService],
  exports: [ComplaintsService],
})
export class ComplaintsModule {}
