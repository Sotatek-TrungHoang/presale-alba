import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ChatService } from 'src/websockets/chat.service';
import { FirebaseAuthGuard } from 'src/guards/firebase-auth.guard';
import { getOrCreateConversationDto } from './dto/get-or-create-conversation.dto';

@Controller('conversations')
export class ConversationController {
  constructor(private chatService: ChatService) {}

  @UseGuards(FirebaseAuthGuard)
  @Post()
  create(@Body() createConversationDto: CreateConversationDto) {
    return this.chatService.createConversation(createConversationDto);
  }

  @UseGuards(FirebaseAuthGuard)
  @Post('get-or-create')
  async getOrCreateConversation(
    @Request() req,
    @Body() getOrCreateConversationDto: getOrCreateConversationDto,
  ) {
    return this.chatService.getOrCreateConversation(
      req.user.uid,
      getOrCreateConversationDto,
    );
  }

  @UseGuards(FirebaseAuthGuard)
  @Get(':userId')
  getConversations(@Param('userId') userId: string) {
    return this.chatService.getConversations(userId);
  }

  @UseGuards(FirebaseAuthGuard)
  @Get(':conversationId/messages')
  getMessages(@Param('conversationId') conversationId: string) {
    return this.chatService.getMessages(conversationId);
  }
}
