import { Module } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ConversationController } from './conversations.controller';
import { FirebaseService } from 'src/firebase/firebase.service';
import { ChatService } from 'src/websockets/chat.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { PushNotificationService } from 'src/notifications/push-notification.service';
@Module({
  controllers: [ConversationController],
  providers: [
    ConversationsService,
    FirebaseService,
    ChatService,
    NotificationsService,
    PushNotificationService,
  ],
})
export class ConversationsModule {}
