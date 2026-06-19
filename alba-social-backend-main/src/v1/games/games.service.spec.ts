import { Test, TestingModule } from '@nestjs/testing';
import { V1GamesService } from './games.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { StripeService } from 'src/stripe/stripe.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  GameFormat,
  GameStatus,
  GameType,
  HandicapRange,
  InviteStatus,
  PlayerStatus,
  TimeSlot,
} from '@prisma/client';
import { CreateGameDto } from './create-game.dto';
import { UpdateGameDto } from './update-game.dto';

describe('V1GamesService', () => {
  let service: V1GamesService;
  let prisma: PrismaService;
  let stripeService: StripeService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
    },
    game: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockStripeService = {
    createPlatformPaymentIntent: jest.fn(),
    createVirtualCardForGame: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        V1GamesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: StripeService, useValue: mockStripeService },
      ],
    }).compile();

    service = module.get<V1GamesService>(V1GamesService);
    prisma = module.get<PrismaService>(PrismaService);
    stripeService = module.get<StripeService>(StripeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAllGamesForUser', () => {
    const authId = 'test-auth-id';
    const userId = 'test-user-id';
    const mockUser = { id: userId, auth_id: authId };

    it('should return all games for the user via GamePlayer', async () => {
      const mockGames = [
        { id: 'game-1', date: new Date('2026-04-01'), players: [] },
        { id: 'game-2', date: new Date('2026-03-01'), players: [] },
      ];
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.game.findMany.mockResolvedValue(mockGames);

      const result = await service.getAllGamesForUser(authId);

      expect(result).toEqual(mockGames);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { auth_id: authId },
      });
      expect(prisma.game.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            deleted_at: null,
            players: {
              some: {
                user_id: userId,
                deleted_at: null,
              },
            },
          },
        }),
      );
    });

    it('should return an empty array when user has no games', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.game.findMany.mockResolvedValue([]);

      const result = await service.getAllGamesForUser(authId);

      expect(result).toEqual([]);
    });

    it('should order results by date descending', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.game.findMany.mockResolvedValue([]);

      await service.getAllGamesForUser(authId);

      expect(prisma.game.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { date: 'desc' },
        }),
      );
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getAllGamesForUser(authId)).rejects.toThrow(
        new NotFoundException('User not found'),
      );

      expect(prisma.game.findMany).not.toHaveBeenCalled();
    });
  });

  describe('createGame', () => {
    const authId = 'test-auth-id';
    const userId = 'test-user-id';
    const courseId = 'course-uuid-1234';
    const mockUser = { id: userId, auth_id: authId };

    const validDto: CreateGameDto = {
      players_needed: 4,
      date: new Date('2026-06-01'),
      time_slot: TimeSlot.EARLY_MORNING,
      game_type: GameType.PURELY_SOCIAL,
      game_format: GameFormat.STROKEPLAY,
      course_id: courseId,
      organiser_handicap: HandicapRange.LOW,
    };

    const mockGame = {
      id: 'game-1',
      course: { id: courseId },
      players: [
        {
          user_id: userId,
          status: PlayerStatus.APPROVED,
          has_approved: true,
          invite_status: InviteStatus.NOT_INVITED,
        },
      ],
    };

    it('should create a game and add the creator as an approved player', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.game.create.mockResolvedValue(mockGame);

      const result = await service.createGame(authId, validDto);

      expect(result).toEqual(mockGame);
      expect(prisma.game.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            creator: { connect: { id: userId } },
            course: { connect: { id: courseId } },
            players_current: 1,
            players_needed: validDto.players_needed,
            status: GameStatus.PLAYERS_REQUIRED,
            players: {
              create: expect.objectContaining({
                user: { connect: { id: userId } },
                status: PlayerStatus.APPROVED,
                has_approved: true,
                invite_status: InviteStatus.NOT_INVITED,
              }),
            },
          }),
        }),
      );
    });

    it('should store cost_per_player in pence when provided', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.game.create.mockResolvedValue(mockGame);

      await service.createGame(authId, { ...validDto, cost_per_player: 1350 });

      expect(prisma.game.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ cost_per_player: 1350 }),
        }),
      );
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.createGame(authId, validDto)).rejects.toThrow(
        new NotFoundException('User not found'),
      );

      expect(prisma.game.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when players_needed is less than 2', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.createGame(authId, { ...validDto, players_needed: 1 }),
      ).rejects.toThrow(
        new BadRequestException('players_needed must be greater than 1'),
      );

      expect(prisma.game.create).not.toHaveBeenCalled();
    });
  });

  describe('updateGame', () => {
    const authId = 'test-auth-id';
    const gameId = 'test-game-id';
    const userId = 'test-user-id';
    const mockUser = { id: userId, auth_id: authId };

    const pendingGame = {
      id: gameId,
      creator_id: userId,
      players_needed: 4,
      status: GameStatus.PLAYERS_REQUIRED,
      players: [
        { id: 'p1', status: PlayerStatus.APPROVED, user_id: userId },
        { id: 'p2', status: PlayerStatus.APPROVED, user_id: 'user-2' },
      ],
    };

    it('should allow creator update and set READY_TO_BOOK when approved players meet players_needed', async () => {
      const dto: UpdateGameDto = { players_needed: 2 };
      const updatedGame = { ...pendingGame, status: GameStatus.READY_TO_BOOK };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.game.findUnique.mockResolvedValue(pendingGame);
      mockPrismaService.game.update.mockResolvedValue(updatedGame);

      const result = await service.updateGame(authId, gameId, dto);

      expect(result).toEqual(updatedGame);
      expect(prisma.game.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: gameId },
          data: expect.objectContaining({
            players_needed: 2,
            players_current: 2,
            status: GameStatus.READY_TO_BOOK,
          }),
        }),
      );
    });

    it('should throw ForbiddenException when updater is not the creator', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.game.findUnique.mockResolvedValue({
        ...pendingGame,
        creator_id: 'another-user',
      });

      await expect(service.updateGame(authId, gameId, {})).rejects.toThrow(
        new ForbiddenException('Only the game creator can update the game'),
      );

      expect(prisma.game.update).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when game is completed or cancelled', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.game.findUnique.mockResolvedValue({
        ...pendingGame,
        status: GameStatus.COMPLETED,
      });

      await expect(service.updateGame(authId, gameId, {})).rejects.toThrow(
        new ConflictException('Cannot update completed or cancelled games'),
      );

      expect(prisma.game.update).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when players_needed is below approved players', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.game.findUnique.mockResolvedValue(pendingGame);

      await expect(
        service.updateGame(authId, gameId, { players_needed: 1 }),
      ).rejects.toThrow(
        new ConflictException(
          'Cannot reduce players_needed to 1. Game already has 2 approved players.',
        ),
      );

      expect(prisma.game.update).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when cost_per_player is updated outside pending status', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.game.findUnique.mockResolvedValue({
        ...pendingGame,
        status: GameStatus.READY_TO_BOOK,
      });

      await expect(
        service.updateGame(authId, gameId, { cost_per_player: 2500 }),
      ).rejects.toThrow(
        new ConflictException(
          'cost_per_player can only be updated while the game is in PLAYERS_REQUIRED status',
        ),
      );

      expect(prisma.game.update).not.toHaveBeenCalled();
    });

    it('should set PLAYERS_REQUIRED when approved players are below updated players_needed', async () => {
      const readyGame = {
        ...pendingGame,
        status: GameStatus.READY_TO_BOOK,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.game.findUnique.mockResolvedValue(readyGame);
      mockPrismaService.game.update.mockResolvedValue({
        ...readyGame,
        status: GameStatus.PLAYERS_REQUIRED,
      });

      await service.updateGame(authId, gameId, { players_needed: 4 });

      expect(prisma.game.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            players_needed: 4,
            players_current: 2,
            status: GameStatus.PLAYERS_REQUIRED,
          }),
        }),
      );
    });
  });

  describe('createPaymentIntentForGame', () => {
    const authId = 'test-auth-id';
    const userId = 'test-user-id';
    const gameId = 'test-game-id';
    const mockUser = { id: userId, auth_id: authId };

    const mockGamePlayer = {
      id: 'player-1',
      user_id: userId,
      game_id: gameId,
      status: PlayerStatus.APPROVED,
      has_paid: false,
    };

    const mockGame = {
      id: gameId,
      cost_per_player: 2500,
      players: [mockGamePlayer],
    };

    const mockStripeResult = {
      clientSecret: 'pi_secret_123',
      paymentIntentId: 'pi_123',
      ephemeralKey: 'ek_123',
      customerId: 'cus_123',
      publishableKey: 'pk_test_123',
    };

    it('should create a platform payment intent with correct fee calculations', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.game.findUnique.mockResolvedValue(mockGame);
      mockStripeService.createPlatformPaymentIntent.mockResolvedValue(
        mockStripeResult,
      );

      const result = await service.createPaymentIntentForGame(authId, gameId);

      // playerShare = 2500, applicationFee = 250 (10%), totalAmount = 2750
      expect(result).toEqual({
        ...mockStripeResult,
        playerShare: 2500,
        applicationFee: 250,
        totalAmount: 2750,
      });
      expect(stripeService.createPlatformPaymentIntent).toHaveBeenCalledWith(
        authId,
        mockGamePlayer.id,
        {
          amount: 2750,
          currency: 'gbp',
          metadata: { game_id: gameId },
        },
      );
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.createPaymentIntentForGame(authId, gameId),
      ).rejects.toThrow(new NotFoundException('User not found'));

      expect(prisma.game.findUnique).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when game does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.game.findUnique.mockResolvedValue(null);

      await expect(
        service.createPaymentIntentForGame(authId, gameId),
      ).rejects.toThrow(new NotFoundException('Game not found'));
    });

    it('should throw BadRequestException when game has no cost set', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.game.findUnique.mockResolvedValue({
        ...mockGame,
        cost_per_player: null,
      });

      await expect(
        service.createPaymentIntentForGame(authId, gameId),
      ).rejects.toThrow(new BadRequestException('This game has no cost set'));
    });

    it('should throw ForbiddenException when user is not a player in the game', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.game.findUnique.mockResolvedValue({
        ...mockGame,
        players: [],
      });

      await expect(
        service.createPaymentIntentForGame(authId, gameId),
      ).rejects.toThrow(
        new ForbiddenException('You are not a player in this game'),
      );
    });

    it('should throw ForbiddenException when player is not APPROVED', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.game.findUnique.mockResolvedValue({
        ...mockGame,
        players: [{ ...mockGamePlayer, status: PlayerStatus.PENDING }],
      });

      await expect(
        service.createPaymentIntentForGame(authId, gameId),
      ).rejects.toThrow(
        new ForbiddenException('Only confirmed players can pay'),
      );
    });

    it('should throw BadRequestException when player has already paid', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.game.findUnique.mockResolvedValue({
        ...mockGame,
        players: [{ ...mockGamePlayer, has_paid: true }],
      });

      await expect(
        service.createPaymentIntentForGame(authId, gameId),
      ).rejects.toThrow(
        new BadRequestException('You have already paid for this game'),
      );
    });
  });

  describe('createVirtualCardForGame', () => {
    const authId = 'test-auth-id';
    const gameId = 'test-game-id';

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

    it('should delegate to stripeService.createVirtualCardForGame and return the result', async () => {
      mockStripeService.createVirtualCardForGame.mockResolvedValue(mockCardResult);

      const result = await service.createVirtualCardForGame(authId, gameId);

      expect(result).toEqual(mockCardResult);
      expect(stripeService.createVirtualCardForGame).toHaveBeenCalledWith(
        authId,
        gameId,
      );
    });

    it('should propagate errors from stripeService', async () => {
      mockStripeService.createVirtualCardForGame.mockRejectedValue(
        new BadRequestException(
          'A virtual card can only be issued when the game is in READY_TO_BOOK status',
        ),
      );

      await expect(
        service.createVirtualCardForGame(authId, gameId),
      ).rejects.toThrow(
        'A virtual card can only be issued when the game is in READY_TO_BOOK status',
      );
    });
  });
});
