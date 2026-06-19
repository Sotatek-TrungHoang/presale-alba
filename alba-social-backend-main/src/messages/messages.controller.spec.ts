import { Test, TestingModule } from '@nestjs/testing';
import { MessageController } from './messages.controller';
import { ChatService } from '../websockets/chat.service';
import { FirebaseAuthGuard } from '../guards/firebase-auth.guard';

describe('MessageController', () => {
  let controller: MessageController;

  const mockChatService = {
    createMessage: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessageController],
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

    controller = module.get<MessageController>(MessageController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
