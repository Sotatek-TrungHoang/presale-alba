import { Module } from '@nestjs/common';
import { RelationshipsService } from './relationships.service';
import { RelationshipsController } from './relationships.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { FirebaseService } from '../firebase/firebase.service';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [RelationshipsController],
  providers: [RelationshipsService, FirebaseService],
  exports: [RelationshipsService],
})
export class RelationshipsModule {}
