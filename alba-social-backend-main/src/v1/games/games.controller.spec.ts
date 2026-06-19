import { Test, TestingModule } from '@nestjs/testing';
import { V1GamesController } from './games.controller';
import { V1GamesService } from './games.service';
import { FirebaseAuthGuard } from 'src/guards/firebase-auth.guard';
import {
  BadRequestException,
  CanActivate,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { GameFormat, GameType, HandicapRange, TimeSlot } from '@prisma/client';
import { CreateGameDto } from './create-game.dto';
import { UpdateGameDto } from './update-game.dto';

describe('V1GamesController', () => {
  let controller: V1GamesController;
  let service: V1GamesService;

  const mockV1GamesService = {
    getAllGamesForUser: jest.fn(),
    createGame: jest.fn(),
    updateGame: jest.fn(),
    createPaymentIntentForGame: jest.fn(),
    createVirtualCardForGame: jest.fn(),
  };

  const mockFirebaseAuthGuard: CanActivate = {
    canActivate: jest.fn(() => true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [V1GamesController],
      providers: [
        {
          provide: V1GamesService,
          useValue: mockV1GamesService,
        },
      ],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue(mockFirebaseAuthGuard)
      .compile();

    controller = module.get<V1GamesController>(V1GamesController);
    service = module.get<V1GamesService>(V1GamesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getGames', () => {
    const authId = 'test-auth-id';
    const mockReq = { user: { uid: authId } };

    it('should return games for the authenticated user', async () => {
      const mockGames = [
        { id: 'game-1', date: new Date('2026-04-01') },
        { id: 'game-2', date: new Date('2026-03-15') },
      ];
      mockV1GamesService.getAllGamesForUser.mockResolvedValue(mockGames);

      const result = await controller.getGames(mockReq);

      expect(result).toEqual(mockGames);
      expect(service.getAllGamesForUser).toHaveBeenCalledWith(authId);
    });

    it('should return an empty array when user has no games', async () => {
      mockV1GamesService.getAllGamesForUser.mockResolvedValue([]);

      const result = await controller.getGames(mockReq);

      expect(result).toEqual([]);
      expect(service.getAllGamesForUser).toHaveBeenCalledWith(authId);
    });

    it('should propagate NotFoundException when user is not found', async () => {
      mockV1GamesService.getAllGamesForUser.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(controller.getGames(mockReq)).rejects.toThrow(
        'User not found',
      );
    });
  });

  describe('createGame', () => {
    const authId = 'test-auth-id';
    const mockReq = { user: { uid: authId } };

    const validDto: CreateGameDto = {
      players_needed: 4,
      date: new Date('2026-06-01'),
      time_slot: TimeSlot.EARLY_MORNING,
      game_type: GameType.PURELY_SOCIAL,
      game_format: GameFormat.STROKEPLAY,
      course_id: 'course-uuid-1234',
      organiser_handicap: HandicapRange.LOW,
    };

    it('should call createGame on the service with the auth id and dto', async () => {
      const mockGame = { id: 'game-1' };
      mockV1GamesService.createGame.mockResolvedValue(mockGame);

      const result = await controller.createGame(mockReq, validDto);

      expect(result).toEqual(mockGame);
      expect(service.createGame).toHaveBeenCalledWith(authId, validDto);
    });

    it('should propagate NotFoundException when user is not found', async () => {
      mockV1GamesService.createGame.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(controller.createGame(mockReq, validDto)).rejects.toThrow(
        'User not found',
      );
    });

    it('should propagate BadRequestException when players_needed is invalid', async () => {
      mockV1GamesService.createGame.mockRejectedValue(
        new BadRequestException('players_needed must be greater than 1'),
      );

      await expect(controller.createGame(mockReq, validDto)).rejects.toThrow(
        'players_needed must be greater than 1',
      );
    });
  });

  describe('updateGame', () => {
    const authId = 'test-auth-id';
    const gameId = 'game-id';
    const mockReq = { user: { uid: authId } };
    const dto: UpdateGameDto = { players_needed: 4 };

    it('should call updateGame on the service with auth id, game id and dto', async () => {
      const mockUpdatedGame = { id: gameId, players_needed: 4 };
      mockV1GamesService.updateGame.mockResolvedValue(mockUpdatedGame);

      const result = await controller.updateGame(mockReq, gameId, dto);

      expect(result).toEqual(mockUpdatedGame);
      expect(service.updateGame).toHaveBeenCalledWith(authId, gameId, dto);
    });

    it('should propagate ForbiddenException when user is not the game creator', async () => {
      mockV1GamesService.updateGame.mockRejectedValue(
        new ForbiddenException('Only the game creator can update the game'),
      );

      await expect(controller.updateGame(mockReq, gameId, dto)).rejects.toThrow(
        'Only the game creator can update the game',
      );
    });

    it('should propagate ConflictException for invalid updates', async () => {
      mockV1GamesService.updateGame.mockRejectedValue(
        new ConflictException('Cannot update completed or cancelled games'),
      );

      await expect(controller.updateGame(mockReq, gameId, dto)).rejects.toThrow(
        'Cannot update completed or cancelled games',
      );
    });
  });

  describe('payForGame', () => {
    const authId = 'test-auth-id';
    const gameId = 'test-game-id';
    const mockReq = { user: { uid: authId } };

    const mockPaymentIntentResult = {
      clientSecret: 'pi_secret_123',
      paymentIntentId: 'pi_123',
      ephemeralKey: 'ek_123',
      customerId: 'cus_123',
      publishableKey: 'pk_test_123',
      playerShare: 2500,
      applicationFee: 250,
      totalAmount: 2750,
    };

    it('should call createPaymentIntentForGame and return the result', async () => {
      mockV1GamesService.createPaymentIntentForGame.mockResolvedValue(
        mockPaymentIntentResult,
      );

      const result = await controller.payForGame(mockReq, gameId);

      expect(result).toEqual(mockPaymentIntentResult);
      expect(service.createPaymentIntentForGame).toHaveBeenCalledWith(
        authId,
        gameId,
      );
    });

    it('should propagate NotFoundException when game is not found', async () => {
      mockV1GamesService.createPaymentIntentForGame.mockRejectedValue(
        new NotFoundException('Game not found'),
      );

      await expect(controller.payForGame(mockReq, gameId)).rejects.toThrow(
        'Game not found',
      );
    });

    it('should propagate ForbiddenException when player is not approved', async () => {
      mockV1GamesService.createPaymentIntentForGame.mockRejectedValue(
        new ForbiddenException('Only confirmed players can pay'),
      );

      await expect(controller.payForGame(mockReq, gameId)).rejects.toThrow(
        'Only confirmed players can pay',
      );
    });

    it('should propagate BadRequestException when player has already paid', async () => {
      mockV1GamesService.createPaymentIntentForGame.mockRejectedValue(
        new BadRequestException('You have already paid for this game'),
      );

      await expect(controller.payForGame(mockReq, gameId)).rejects.toThrow(
        'You have already paid for this game',
      );
    });
  });

  describe('createVirtualCardForGame', () => {
    const authId = 'test-auth-id';
    const gameId = 'test-game-id';
    const mockReq = { user: { uid: authId } };

    const mockCardResult = {
      card_id: 'ic_123',
      card_number: '4000056655665556',
      last4: '5556',
      cvc: '123',
      exp_month: 12,
      exp_year: 2026,
      amount_pence: 4000,
      status: 'active',
    };

    it('should call createVirtualCardForGame and return the result', async () => {
      mockV1GamesService.createVirtualCardForGame.mockResolvedValue(
        mockCardResult,
      );

      const result = await controller.createVirtualCardForGame(mockReq, gameId);

      expect(result).toEqual(mockCardResult);
      expect(service.createVirtualCardForGame).toHaveBeenCalledWith(
        authId,
        gameId,
      );
    });

    it('should propagate NotFoundException when game is not found', async () => {
      mockV1GamesService.createVirtualCardForGame.mockRejectedValue(
        new NotFoundException('Game not found'),
      );

      await expect(
        controller.createVirtualCardForGame(mockReq, gameId),
      ).rejects.toThrow('Game not found');
    });

    it('should propagate BadRequestException when game is not READY_TO_BOOK', async () => {
      mockV1GamesService.createVirtualCardForGame.mockRejectedValue(
        new BadRequestException(
          'A virtual card can only be issued when the game is in READY_TO_BOOK status',
        ),
      );

      await expect(
        controller.createVirtualCardForGame(mockReq, gameId),
      ).rejects.toThrow(
        'A virtual card can only be issued when the game is in READY_TO_BOOK status',
      );
    });

    it('should propagate BadRequestException when payment is not FULLY_PAID', async () => {
      mockV1GamesService.createVirtualCardForGame.mockRejectedValue(
        new BadRequestException(
          'A virtual card can only be issued when the game payment status is FULLY_PAID',
        ),
      );

      await expect(
        controller.createVirtualCardForGame(mockReq, gameId),
      ).rejects.toThrow(
        'A virtual card can only be issued when the game payment status is FULLY_PAID',
      );
    });
  });
});
