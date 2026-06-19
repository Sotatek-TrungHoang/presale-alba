import { Test, TestingModule } from '@nestjs/testing';
import { ConversationController } from './conversations.controller';
import { ChatService } from '../websockets/chat.service';
import { FirebaseAuthGuard } from '../guards/firebase-auth.guard';

describe('ConversationController', () => {
  let controller: ConversationController;

  const mockChatService = {
    createConversation: jest.fn(),
    getOrCreateConversation: jest.fn(),
    getConversations: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConversationController],
      providers: [
        {
          provide: ChatService,
          useValue: mockChatService,
        },
      ],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<ConversationController>(ConversationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
