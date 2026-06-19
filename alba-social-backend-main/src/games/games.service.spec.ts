import { Test, TestingModule } from '@nestjs/testing';
import { GamesService } from './games.service';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { NotificationsService } from '../notifications/notifications.service';
import { GameStatus, PlayerStatus } from '@prisma/client';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';

describe('GamesService', () => {
  let service: GamesService;
  let prisma: PrismaService;
  let stripe: StripeService;

  const mockPrismaService = {
    game: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    gamePlayer: {
      update: jest.fn(),
    },
  };

  const mockStripeService = {
    createPaymentIntent: jest.fn(),
  };

  const mockNotificationsService = {
    createPaymentConfirmationNotification: jest.fn(),
    createAllPlayersPaidNotification: jest.fn(),
    createGameConfirmedNotification: jest.fn().mockReturnValue({}),
    sendNotificationToUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: StripeService, useValue: mockStripeService },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<GamesService>(GamesService);
    prisma = module.get<PrismaService>(PrismaService);
    stripe = module.get<StripeService>(StripeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getNearbyUsersForGame', () => {
    it('should return users within 5km of the game sorted by distance', async () => {
      mockPrismaService.game.findUnique.mockResolvedValue({
        id: 'game-123',
        lat: 51.5,
        lng: -0.1,
        course: null,
        players: [{ user_id: 'user-in-game' }],
      });

      mockPrismaService.user.findMany.mockResolvedValue([
        {
          id: 'user-near-2',
          profile: { first_name: 'Near Two' },
          latestLocation: { lat: 51.52, lng: -0.1 },
        },
        {
          id: 'user-near-1',
          profile: { first_name: 'Near One' },
          latestLocation: { lat: 51.5005, lng: -0.1005 },
        },
        {
          id: 'user-far',
          profile: { first_name: 'Far Away' },
          latestLocation: { lat: 51.7, lng: -0.1 },
        },
      ]);

      const result = await service.getNearbyUsersForGame('game-123');

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        where: {
          deleted_at: null,
          id: {
            notIn: ['user-in-game'],
          },
          latestLocation: {
            deleted_at: null,
          },
        },
        include: {
          profile: true,
          onboarding: true,
          latestLocation: true,
        },
      });
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('user-near-1');
      expect(result[1].id).toBe('user-near-2');
      expect(result.every((user) => user.distanceKm <= 5)).toBe(true);
    });

    it('should throw when the game has no location', async () => {
      mockPrismaService.game.findUnique.mockResolvedValue({
        id: 'game-123',
        lat: null,
        lng: null,
        course: null,
        players: [],
      });

      await expect(service.getNearbyUsersForGame('game-123')).rejects.toThrow(
        new BadRequestException('Game does not have a valid location'),
      );
    });
  });

  describe('getGamePaymentDetails', () => {
    const gameId = 'game-123';
    const payerAuthId = 'payer-auth-123';
    const payerUserId = 'payer-user-123';

    const mockGame = {
      id: gameId,
      status: GameStatus.READY,
      cost_per_player: 5000,
      players: [
        {
          user_id: payerUserId,
          status: PlayerStatus.APPROVED,
          has_paid: false,
        },
      ],
    };

    const mockPayer = {
      id: payerUserId,
      auth_id: payerAuthId,
    };

    it('should return correct payment details for a valid request', async () => {
      mockPrismaService.game.findUnique.mockResolvedValue(mockGame);
      jest
        .spyOn(service, 'getUserByAuthId')
        .mockResolvedValue(mockPayer as any);

      const result = await service.getGamePaymentDetails(payerAuthId, gameId);

      expect(result).toEqual({
        playerShare: 5000,
        applicationFee: 500,
        totalAmount: 5500,
        currency: 'gbp',
      });
      expect(mockPrismaService.game.findUnique).toHaveBeenCalledWith({
        where: { id: gameId },
        include: { players: true },
      });
    });

    it('should throw BadRequestException if game is not ready', async () => {
      mockPrismaService.game.findUnique.mockResolvedValue({
        ...mockGame,
        status: GameStatus.PLAYERS_REQUIRED,
      });
      jest
        .spyOn(service, 'getUserByAuthId')
        .mockResolvedValue(mockPayer as any);

      await expect(
        service.getGamePaymentDetails(payerAuthId, gameId),
      ).rejects.toThrow(
        new BadRequestException('This game is not ready for payment.'),
      );
    });

    it('should throw ForbiddenException if user is not a player', async () => {
      mockPrismaService.game.findUnique.mockResolvedValue({
        ...mockGame,
        players: [],
      });
      jest
        .spyOn(service, 'getUserByAuthId')
        .mockResolvedValue(mockPayer as any);

      await expect(
        service.getGamePaymentDetails(payerAuthId, gameId),
      ).rejects.toThrow(
        new ForbiddenException('You are not a player in this game.'),
      );
    });
  });

  describe('createGamePaymentIntent', () => {
    const gameId = 'game-123';
    const payerAuthId = 'payer-auth-123';
    const payerUserId = 'payer-user-123';
    const creatorAuthId = 'creator-auth-123';

    const mockGameWithCreator = {
      id: gameId,
      status: GameStatus.READY,
      cost_per_player: 5000,
      players: [
        {
          id: 'gp-123',
          user_id: payerUserId,
          status: PlayerStatus.APPROVED,
          has_paid: false,
        },
      ],
      creator: {
        auth_id: creatorAuthId,
      },
    };

    const mockPayer = {
      id: payerUserId,
      auth_id: payerAuthId,
    };

    it('should call stripe service with correct parameters', async () => {
      mockPrismaService.game.findUnique.mockResolvedValue(mockGameWithCreator);
      jest
        .spyOn(service, 'getUserByAuthId')
        .mockResolvedValue(mockPayer as any);
      mockStripeService.createPaymentIntent.mockResolvedValue({
        clientSecret: 'pi_123',
      });

      await service.createGamePaymentIntent(payerAuthId, gameId);

      expect(mockStripeService.createPaymentIntent).toHaveBeenCalledWith(
        payerAuthId,
        {
          amount: 5500,
          currency: 'gbp',
          recipientAuthId: creatorAuthId,
          applicationFeeAmount: 500,
          metadata: {
            game_id: gameId,
            game_player_id: 'gp-123',
            payer_user_id: payerUserId,
            playerShare: '5000',
            applicationFee: '500',
          },
        },
      );
    });

    it('should throw BadRequestException if cost is not set', async () => {
      mockPrismaService.game.findUnique.mockResolvedValue({
        ...mockGameWithCreator,
        cost_per_player: 0,
      });
      jest
        .spyOn(service, 'getUserByAuthId')
        .mockResolvedValue(mockPayer as any);

      await expect(
        service.createGamePaymentIntent(payerAuthId, gameId),
      ).rejects.toThrow(
        new BadRequestException(
          'The cost for this game has not been set by the organizer.',
        ),
      );
    });

    it('should throw NotFoundException if game creator not found', async () => {
      mockPrismaService.game.findUnique.mockResolvedValue({
        ...mockGameWithCreator,
        creator: { auth_id: null },
      });
      jest
        .spyOn(service, 'getUserByAuthId')
        .mockResolvedValue(mockPayer as any);

      await expect(
        service.createGamePaymentIntent(payerAuthId, gameId),
      ).rejects.toThrow(
        new NotFoundException(
          "Could not find the game creator's details to process payment.",
        ),
      );
    });
  });

  describe('findAllPaginated', () => {
    it('should return paginated games with pagination metadata', async () => {
      const paginateDto = { page: 2, limit: 20 };
      const games = [{ id: 'game-1' }, { id: 'game-2' }];

      mockPrismaService.game.findMany.mockResolvedValue(games);
      mockPrismaService.game.count.mockResolvedValue(45);

      const result = await service.findAllPaginated(paginateDto);

      expect(mockPrismaService.game.findMany).toHaveBeenCalledWith({
        where: { deleted_at: null },
        include: {
          creator: { include: { profile: true } },
          course: true,
          group: true,
          players: {
            where: { deleted_at: null },
            include: { user: { include: { profile: true } } },
          },
        },
        skip: 20,
        take: 20,
        orderBy: [{ date: 'desc' }, { created_at: 'desc' }],
      });
      expect(mockPrismaService.game.count).toHaveBeenCalledWith({
        where: { deleted_at: null },
      });
      expect(result).toEqual({
        data: games,
        pagination: {
          page: 2,
          limit: 20,
          total: 45,
          totalPages: 3,
          hasNextPage: true,
          hasPreviousPage: true,
        },
      });
    });

    it('should use default pagination values when not provided', async () => {
      const games = [];

      mockPrismaService.game.findMany.mockResolvedValue(games);
      mockPrismaService.game.count.mockResolvedValue(0);

      const result = await service.findAllPaginated({});

      expect(mockPrismaService.game.findMany).toHaveBeenCalledWith({
        where: { deleted_at: null },
        include: {
          creator: { include: { profile: true } },
          course: true,
          group: true,
          players: {
            where: { deleted_at: null },
            include: { user: { include: { profile: true } } },
          },
        },
        skip: 0,
        take: 20,
        orderBy: [{ date: 'desc' }, { created_at: 'desc' }],
      });
      expect(result).toEqual({
        data: games,
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });
    });

    it('should return only soft-deleted games when status is DELETED', async () => {
      const games = [{ id: 'game-deleted-1', deleted_at: new Date() }];

      mockPrismaService.game.findMany.mockResolvedValue(games);
      mockPrismaService.game.count.mockResolvedValue(1);

      await service.findAllPaginated({ status: 'DELETED' as any });

      expect(mockPrismaService.game.findMany).toHaveBeenCalledWith({
        where: { deleted_at: { not: null } },
        include: {
          creator: { include: { profile: true } },
          course: true,
          group: true,
          players: {
            where: { deleted_at: null },
            include: { user: { include: { profile: true } } },
          },
        },
        skip: 0,
        take: 20,
        orderBy: [{ date: 'desc' }, { created_at: 'desc' }],
      });
      expect(mockPrismaService.game.count).toHaveBeenCalledWith({
        where: { deleted_at: { not: null } },
      });
    });
  });

  describe('confirmGameDetails', () => {
    const gameId = 'game-123';
    const authId = 'auth-123';
    const userId = 'user-123';
    const creatorPlayerId = 'cp-123';

    const mockUser = { id: userId, auth_id: authId };

    const mockCreatorPlayer = {
      id: creatorPlayerId,
      user_id: userId,
      status: PlayerStatus.APPROVED,
      has_paid: true,
    };

    const mockGame = {
      id: gameId,
      creator_id: userId,
      status: GameStatus.READY_TO_BOOK,
      players_needed: 4,
      course_id: 'course-123',
      date: new Date('2026-06-01'),
      time_slot: 'EARLY_MORNING',
      exact_time: '08:00',
      total_cost: 20000,
      cost_per_player: 5000,
      players: [mockCreatorPlayer],
    };

    const mockUpdatedGame = {
      ...mockGame,
      status: GameStatus.READY,
      players: [{ ...mockCreatorPlayer, user: { profile: {} } }],
      creator: { profile: {} },
      course: {},
      group: null,
    };

    beforeEach(() => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.game.findUnique.mockResolvedValue(mockGame);
      mockPrismaService.game.update.mockResolvedValue(mockUpdatedGame);
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.confirmGameDetails(gameId, authId, {}),
      ).rejects.toThrow(new NotFoundException('User not found'));
    });

    it('should throw NotFoundException if game not found', async () => {
      mockPrismaService.game.findUnique.mockResolvedValue(null);

      await expect(
        service.confirmGameDetails(gameId, authId, {}),
      ).rejects.toThrow(new NotFoundException('Game not found'));
    });

    it('should throw ForbiddenException if user is not the creator', async () => {
      mockPrismaService.game.findUnique.mockResolvedValue({
        ...mockGame,
        creator_id: 'other-user-id',
      });

      await expect(
        service.confirmGameDetails(gameId, authId, {}),
      ).rejects.toThrow(
        new ForbiddenException('Only the creator can confirm game details'),
      );
    });

    it('should throw ConflictException if game is not in READY_TO_BOOK status', async () => {
      mockPrismaService.game.findUnique.mockResolvedValue({
        ...mockGame,
        status: GameStatus.PLAYERS_REQUIRED,
      });

      await expect(
        service.confirmGameDetails(gameId, authId, {}),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if creator player record not found', async () => {
      mockPrismaService.game.findUnique.mockResolvedValue({
        ...mockGame,
        players: [],
      });

      await expect(
        service.confirmGameDetails(gameId, authId, {}),
      ).rejects.toThrow(
        new ConflictException(
          'Creator player record not found. Cannot confirm game.',
        ),
      );
    });

    it('should transition game to READY when all required fields are present', async () => {
      await service.confirmGameDetails(gameId, authId, {
        exact_time: '09:00',
        total_cost: 20000,
        cost_per_player: 5000,
      });

      expect(mockPrismaService.game.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: gameId },
          data: expect.objectContaining({ status: GameStatus.READY }),
        }),
      );
    });

    it('should remain READY_TO_BOOK when exact_time is missing', async () => {
      mockPrismaService.game.findUnique.mockResolvedValue({
        ...mockGame,
        exact_time: null,
      });

      await service.confirmGameDetails(gameId, authId, {
        total_cost: 20000,
        cost_per_player: 5000,
      });

      expect(mockPrismaService.game.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: GameStatus.READY_TO_BOOK }),
        }),
      );
    });

    it('should remain READY_TO_BOOK when total_cost is missing', async () => {
      mockPrismaService.game.findUnique.mockResolvedValue({
        ...mockGame,
        total_cost: null,
        cost_per_player: null,
      });

      await service.confirmGameDetails(gameId, authId, { exact_time: '09:00' });

      expect(mockPrismaService.game.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: GameStatus.READY_TO_BOOK }),
        }),
      );
    });

    it('should use cost_per_player from DTO when explicitly provided', async () => {
      await service.confirmGameDetails(gameId, authId, {
        cost_per_player: 7500,
      });

      expect(mockPrismaService.game.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ cost_per_player: 7500 }),
        }),
      );
    });

    it('should fall back to existing cost_per_player when not provided in DTO', async () => {
      await service.confirmGameDetails(gameId, authId, {});

      expect(mockPrismaService.game.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ cost_per_player: 5000 }),
        }),
      );
    });

    it('should auto-calculate cost_per_player from total_cost when not already set', async () => {
      mockPrismaService.game.findUnique.mockResolvedValue({
        ...mockGame,
        cost_per_player: null,
        players_needed: 4,
        total_cost: 20000,
      });

      await service.confirmGameDetails(gameId, authId, { exact_time: '09:00' });

      // 20000 / 4 = 5000
      expect(mockPrismaService.game.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ cost_per_player: 5000 }),
        }),
      );
    });

    it('should not overwrite existing cost_per_player during auto-calculation', async () => {
      // cost_per_player is already set — should not be recalculated
      await service.confirmGameDetails(gameId, authId, { total_cost: 40000 });

      expect(mockPrismaService.game.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ cost_per_player: 5000 }),
        }),
      );
    });

    it('should mark creator as paid when not already paid', async () => {
      mockPrismaService.game.findUnique.mockResolvedValue({
        ...mockGame,
        players: [{ ...mockCreatorPlayer, has_paid: false }],
      });

      await service.confirmGameDetails(gameId, authId, {});

      expect(mockPrismaService.gamePlayer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: creatorPlayerId },
          data: expect.objectContaining({
            has_paid: true,
            payment_amount: 0,
          }),
        }),
      );
    });

    it('should not update gamePlayer when creator is already paid', async () => {
      await service.confirmGameDetails(gameId, authId, {});

      expect(mockPrismaService.gamePlayer.update).not.toHaveBeenCalled();
    });

    it('should send notifications to approved players when game transitions to READY', async () => {
      await service.confirmGameDetails(gameId, authId, {
        exact_time: '09:00',
        total_cost: 20000,
        cost_per_player: 5000,
      });

      expect(
        mockNotificationsService.createGameConfirmedNotification,
      ).toHaveBeenCalledWith(
        gameId,
        expect.any(String),
        expect.anything(),
        expect.anything(),
      );
      expect(
        mockNotificationsService.sendNotificationToUser,
      ).toHaveBeenCalled();
    });

    it('should not send notifications when game remains READY_TO_BOOK', async () => {
      mockPrismaService.game.findUnique.mockResolvedValue({
        ...mockGame,
        exact_time: null,
      });

      await service.confirmGameDetails(gameId, authId, {});

      expect(
        mockNotificationsService.createGameConfirmedNotification,
      ).not.toHaveBeenCalled();
    });
  });
});
