import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessageController } from './messages.controller';
import { FirebaseService } from 'src/firebase/firebase.service';
import { ChatService } from 'src/websockets/chat.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { PushNotificationService } from 'src/notifications/push-notification.service';

@Module({
  controllers: [MessageController],
  providers: [
    MessagesService,
    FirebaseService,
    ChatService,
    NotificationsService,
    PushNotificationService,
  ],
})
export class MessagesModule {}
