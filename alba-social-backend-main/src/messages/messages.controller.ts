import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { CreateMessageDto } from './dto/create-message.dto';
import { FirebaseAuthGuard } from 'src/guards/firebase-auth.guard';
import { ChatService } from 'src/websockets/chat.service';

@Controller('messages')
export class MessageController {
  constructor(private chatService: ChatService) {}

  @UseGuards(FirebaseAuthGuard)
  @Post()
  create(@Body() createMessageDto: CreateMessageDto) {
    return this.chatService.createMessage(createMessageDto);
  }
}
