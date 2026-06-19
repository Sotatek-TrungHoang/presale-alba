import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ConversationController } from 'src/conversations/conversations.controller';
import { MessageController } from 'src/messages/messages.controller';
import { FirebaseService } from 'src/firebase/firebase.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [NotificationsModule, PrismaModule],
  providers: [ChatGateway, ChatService, FirebaseService],
  controllers: [ConversationController, MessageController],
  exports: [ChatService],
})
export class ChatModule {}
