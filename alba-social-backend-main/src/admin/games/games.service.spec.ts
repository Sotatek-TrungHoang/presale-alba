import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AdminGamesService } from './games.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { GameStatus, InviteStatus, PlayerStatus } from '@prisma/client';

describe('AdminGamesService', () => {
  let service: AdminGamesService;

  const mockPrismaService = {
    game: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
    golfCourse: {
      findFirst: jest.fn(),
    },
    group: {
      findFirst: jest.fn(),
    },
    gamePlayer: {
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    conversationParticipant: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockNotificationsService = {
    sendNotificationToUser: jest.fn(),
    createGameNearbyNotification: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminGamesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    service = module.get<AdminGamesService>(AdminGamesService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw NotFoundException when game does not exist', async () => {
    mockPrismaService.game.findUnique.mockResolvedValue(null);

    await expect(service.updateGame('missing-game', {})).rejects.toThrow(
      new NotFoundException('Game not found'),
    );
  });

  describe('notifyNearbyUsers', () => {
    it('should notify selected users when they are not already in the game', async () => {
      mockPrismaService.game.findFirst.mockResolvedValue({
        id: 'game-1',
        date: new Date('2026-05-01T10:00:00.000Z'),
        location: 'Royal Liverpool',
        creator: {
          profile: { first_name: 'James' },
          email: 'james@example.com',
        },
        course: { name: 'Hoylake' },
        players: [],
      });

      mockNotificationsService.createGameNearbyNotification.mockReturnValue({
        title: 'Game Nearby',
        body: 'test body',
        data: { action: 'game_nearby', gameId: 'game-1' },
        type: 'GAME',
      });

      const result = await service.notifyNearbyUsers('game-1', [
        'user-1',
        'user-2',
      ]);

      expect(mockNotificationsService.sendNotificationToUser).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        success: true,
        notifiedCount: 2,
        notifiedUserIds: ['user-1', 'user-2'],
      });
    });

    it('should throw when a selected user is already in the game', async () => {
      mockPrismaService.game.findFirst.mockResolvedValue({
        id: 'game-1',
        date: new Date('2026-05-01T10:00:00.000Z'),
        creator: { profile: { first_name: 'James' }, email: 'james@example.com' },
        course: { name: 'Hoylake' },
        players: [{ user_id: 'user-3' }],
      });

      await expect(
        service.notifyNearbyUsers('game-1', ['user-1', 'user-3']),
      ).rejects.toThrow(
        new BadRequestException('Some selected users are already part of the game'),
      );
    });
  });

  describe('createGame', () => {
    it('should create a game with PLAYERS_REQUIRED status', async () => {
      const authId = 'auth-creator-1';
      const createDto = {
        date: '2026-05-01T10:00:00.000Z',
        time_slot: 'LATE_MORNING',
        players_needed: 4,
        game_type: 'RELAXED_ROUND',
      };

      mockPrismaService.user.findFirst.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.game.create.mockResolvedValue({
        id: 'game-1',
        status: GameStatus.PLAYERS_REQUIRED,
      });

      const result = await service.createGame(authId, createDto as any);

      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: {
          auth_id: authId,
          deleted_at: null,
        },
      });

      expect(mockPrismaService.game.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            players_needed: 4,
            players_current: 0,
            status: GameStatus.PLAYERS_REQUIRED,
          }),
        }),
      );
      expect(result).toEqual({
        id: 'game-1',
        status: GameStatus.PLAYERS_REQUIRED,
      });
    });

    it('should throw BadRequestException when players_needed is not greater than 2', async () => {
      await expect(
        service.createGame(
          'auth-creator-1',
          {
            date: '2026-05-01T10:00:00.000Z',
            time_slot: 'LATE_MORNING',
            players_needed: 2,
            game_type: 'RELAXED_ROUND',
          } as any,
        ),
      ).rejects.toThrow(
        new BadRequestException('players_needed must be greater than 2'),
      );
    });
  });

  describe('addPlayerToGame', () => {
    it('should add a new player with PENDING status', async () => {
      const gameId = 'game-1';
      const userId = 'user-1';
      const expectedGame = { id: gameId, players: [] };

      mockPrismaService.game.findFirst.mockResolvedValue({ id: gameId });
      mockPrismaService.user.findFirst.mockResolvedValue({ id: userId });
      mockPrismaService.gamePlayer.findFirst.mockResolvedValue(null);
      mockPrismaService.gamePlayer.create.mockResolvedValue({ id: 'gp-1' });
      mockPrismaService.game.findUnique.mockResolvedValue(expectedGame);

      const result = await service.addPlayerToGame(gameId, userId);

      expect(mockPrismaService.gamePlayer.create).toHaveBeenCalledWith({
        data: {
          game_id: gameId,
          user_id: userId,
          status: PlayerStatus.PENDING,
          invite_status: InviteStatus.NOT_INVITED,
          has_approved: false,
        },
      });
      expect(result).toEqual(expectedGame);
    });

    it('should reactivate a soft-deleted player as PENDING', async () => {
      const gameId = 'game-1';
      const userId = 'user-1';

      mockPrismaService.game.findFirst.mockResolvedValue({ id: gameId });
      mockPrismaService.user.findFirst.mockResolvedValue({ id: userId });
      mockPrismaService.gamePlayer.findFirst.mockResolvedValue({
        id: 'gp-1',
        deleted_at: new Date('2026-01-01T00:00:00.000Z'),
      });
      mockPrismaService.game.findUnique.mockResolvedValue({ id: gameId });

      await service.addPlayerToGame(gameId, userId);

      expect(mockPrismaService.gamePlayer.update).toHaveBeenCalledWith({
        where: { id: 'gp-1' },
        data: {
          status: PlayerStatus.PENDING,
          invite_status: InviteStatus.NOT_INVITED,
          has_approved: false,
          deleted_at: null,
        },
      });
    });

    it('should throw ConflictException when user is already active in game', async () => {
      mockPrismaService.game.findFirst.mockResolvedValue({ id: 'game-1' });
      mockPrismaService.user.findFirst.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.gamePlayer.findFirst.mockResolvedValue({
        id: 'gp-1',
        deleted_at: null,
      });

      await expect(service.addPlayerToGame('game-1', 'user-1')).rejects.toThrow(
        new ConflictException('User is already in this game'),
      );
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockPrismaService.game.findFirst.mockResolvedValue({ id: 'game-1' });
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(service.addPlayerToGame('game-1', 'user-1')).rejects.toThrow(
        new NotFoundException('User not found'),
      );
    });
  });

  describe('updateGamePlayerStatus', () => {
    it('should update player status and set game to READY_TO_BOOK when approved count equals players_needed', async () => {
      const gameId = 'game-1';
      const userId = 'user-1';
      const updatedGame = {
        id: gameId,
        players_current: 4,
        status: GameStatus.READY_TO_BOOK,
      };

      mockPrismaService.game.findFirst.mockResolvedValue({
        id: gameId,
        players_needed: 4,
      });
      mockPrismaService.gamePlayer.findFirst.mockResolvedValue({
        id: 'gp-1',
      });

      const tx = {
        gamePlayer: {
          update: jest.fn(),
          count: jest.fn().mockResolvedValue(4),
        },
        game: {
          update: jest.fn(),
        },
      };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        await callback(tx);
      });
      mockPrismaService.game.findUnique.mockResolvedValue(updatedGame);

      const result = await service.updateGamePlayerStatus(
        gameId,
        userId,
        PlayerStatus.APPROVED,
      );

      expect(tx.gamePlayer.update).toHaveBeenCalledWith({
        where: { id: 'gp-1' },
        data: {
          status: PlayerStatus.APPROVED,
          has_approved: true,
        },
      });
      expect(tx.game.update).toHaveBeenCalledWith({
        where: { id: gameId },
        data: {
          players_current: 4,
          status: GameStatus.READY_TO_BOOK,
        },
      });
      expect(result).toEqual(updatedGame);
    });

    it('should throw NotFoundException when player is not in game', async () => {
      mockPrismaService.game.findFirst.mockResolvedValue({
        id: 'game-1',
        players_needed: 4,
      });
      mockPrismaService.gamePlayer.findFirst.mockResolvedValue(null);

      await expect(
        service.updateGamePlayerStatus('game-1', 'user-1', PlayerStatus.REJECTED),
      ).rejects.toThrow(new NotFoundException('Player not found in this game'));
    });
  });

  describe('removePlayerFromGame', () => {
    it('should remove an unpaid player and set status to PLAYERS_REQUIRED when players_needed > players_current', async () => {
      const gameId = 'game-1';
      const userId = 'user-1';
      const updatedGame = {
        id: gameId,
        players_current: 2,
        status: GameStatus.PLAYERS_REQUIRED,
      };

      mockPrismaService.game.findFirst.mockResolvedValue({
        id: gameId,
        players_needed: 4,
        conversation: { id: 'conv-1' },
      });
      mockPrismaService.gamePlayer.findFirst.mockResolvedValue({
        id: 'gp-1',
        has_paid: false,
      });

      const tx = {
        gamePlayer: {
          update: jest.fn(),
          count: jest.fn().mockResolvedValue(2),
        },
        conversationParticipant: {
          updateMany: jest.fn(),
        },
        game: {
          update: jest.fn(),
        },
      };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        await callback(tx);
      });
      mockPrismaService.game.findUnique.mockResolvedValue(updatedGame);

      const result = await service.removePlayerFromGame(gameId, userId);

      expect(tx.gamePlayer.update).toHaveBeenCalledWith({
        where: { id: 'gp-1' },
        data: {
          status: PlayerStatus.REJECTED,
          has_approved: false,
          deleted_at: expect.any(Date),
        },
      });
      expect(tx.conversationParticipant.updateMany).toHaveBeenCalledWith({
        where: {
          conversation_id: 'conv-1',
          user_id: userId,
          deleted_at: null,
        },
        data: {
          deleted_at: expect.any(Date),
        },
      });
      expect(tx.game.update).toHaveBeenCalledWith({
        where: { id: gameId },
        data: {
          players_current: 2,
          status: GameStatus.PLAYERS_REQUIRED,
        },
      });
      expect(result).toEqual(updatedGame);
    });

    it('should set status to READY_TO_BOOK when players_needed equals players_current after removal', async () => {
      const gameId = 'game-1';
      const userId = 'user-1';

      mockPrismaService.game.findFirst.mockResolvedValue({
        id: gameId,
        players_needed: 2,
        conversation: null,
      });
      mockPrismaService.gamePlayer.findFirst.mockResolvedValue({
        id: 'gp-1',
        has_paid: false,
      });

      const tx = {
        gamePlayer: {
          update: jest.fn(),
          count: jest.fn().mockResolvedValue(2),
        },
        conversationParticipant: {
          updateMany: jest.fn(),
        },
        game: {
          update: jest.fn(),
        },
      };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        await callback(tx);
      });
      mockPrismaService.game.findUnique.mockResolvedValue({ id: gameId });

      await service.removePlayerFromGame(gameId, userId);

      expect(tx.game.update).toHaveBeenCalledWith({
        where: { id: gameId },
        data: {
          players_current: 2,
          status: GameStatus.READY_TO_BOOK,
        },
      });
    });

    it('should throw ConflictException when trying to remove a paid player', async () => {
      mockPrismaService.game.findFirst.mockResolvedValue({
        id: 'game-1',
        players_needed: 4,
      });
      mockPrismaService.gamePlayer.findFirst.mockResolvedValue({
        id: 'gp-1',
        has_paid: true,
      });

      await expect(service.removePlayerFromGame('game-1', 'user-1')).rejects.toThrow(
        new ConflictException('Paid players cannot be removed from a game'),
      );
    });
  });

  describe('deleteGame', () => {
    it('should soft delete a game by setting deleted_at', async () => {
      const gameId = 'game-123';
      const updatedGame = {
        id: gameId,
        deleted_at: new Date('2026-05-06T10:00:00.000Z'),
      };

      mockPrismaService.game.findFirst.mockResolvedValue({
        id: gameId,
        deleted_at: null,
      });
      mockPrismaService.game.update.mockResolvedValue(updatedGame);

      const result = await service.deleteGame(gameId);

      expect(mockPrismaService.game.findFirst).toHaveBeenCalledWith({
        where: {
          id: gameId,
          deleted_at: null,
        },
      });
      expect(mockPrismaService.game.update).toHaveBeenCalledWith({
        where: { id: gameId },
        data: {
          deleted_at: expect.any(Date),
        },
        include: expect.any(Object),
      });
      expect(result).toEqual(updatedGame);
    });

    it('should throw NotFoundException when soft deleting a missing game', async () => {
      mockPrismaService.game.findFirst.mockResolvedValue(null);

      await expect(service.deleteGame('missing-game')).rejects.toThrow(
        new NotFoundException('Game not found'),
      );
    });
  });

  it('should update game fields', async () => {
    const gameId = 'game-123';
    const existingGame = {
      id: gameId,
      players_current: 2,
      players_needed: 4,
    };

    const updatedGame = {
      id: gameId,
      players_current: 3,
      players_needed: 4,
    };

    mockPrismaService.game.findUnique.mockResolvedValue(existingGame);
    mockPrismaService.gamePlayer.count.mockResolvedValue(3);
    mockPrismaService.user.findFirst.mockResolvedValue({ id: 'creator-2' });
    mockPrismaService.golfCourse.findFirst.mockResolvedValue({ id: 'course-2' });
    mockPrismaService.group.findFirst.mockResolvedValue({ id: 'group-2' });
    mockPrismaService.game.update.mockResolvedValue(updatedGame);

    const result = await service.updateGame(gameId, {
      creator_id: 'creator-2',
      course_id: 'course-2',
      group_id: 'group-2',
      date: '2026-05-01T10:00:00.000Z',
      players_needed: 4,
    });

    expect(mockPrismaService.game.update).toHaveBeenCalledWith({
      where: { id: gameId },
      data: {
        creator: { connect: { id: 'creator-2' } },
        course: { connect: { id: 'course-2' } },
        group: { connect: { id: 'group-2' } },
        date: new Date('2026-05-01T10:00:00.000Z'),
        players_needed: 4,
        players_current: 3,
        status: GameStatus.PLAYERS_REQUIRED,
      },
      include: expect.any(Object),
    });
    expect(result).toEqual(updatedGame);
  });

  it('should set status to READY_TO_BOOK when players_needed equals players_current', async () => {
    const gameId = 'game-123';
    mockPrismaService.game.findUnique.mockResolvedValue({
      id: gameId,
      players_current: 2,
      players_needed: 4,
    });
    mockPrismaService.gamePlayer.count.mockResolvedValue(4);
    mockPrismaService.game.update.mockResolvedValue({ id: gameId });

    await service.updateGame(gameId, {
      players_needed: 4,
    });

    expect(mockPrismaService.game.update).toHaveBeenCalledWith({
      where: { id: gameId },
      data: {
        players_needed: 4,
        players_current: 4,
        status: GameStatus.READY_TO_BOOK,
      },
      include: expect.any(Object),
    });
  });

  it('should disconnect optional relations and soft delete a game', async () => {
    const gameId = 'game-123';
    mockPrismaService.game.findUnique.mockResolvedValue({
      id: gameId,
      players_current: 2,
      players_needed: 4,
    });
    mockPrismaService.gamePlayer.count.mockResolvedValue(2);
    mockPrismaService.game.update.mockResolvedValue({ id: gameId });

    await service.updateGame(gameId, {
      course_id: null,
      group_id: null,
      deleted: true,
    });

    expect(mockPrismaService.game.update).toHaveBeenCalledWith({
      where: { id: gameId },
      data: {
        course: { disconnect: true },
        group: { disconnect: true },
        players_current: 2,
        status: GameStatus.PLAYERS_REQUIRED,
        deleted_at: expect.any(Date),
      },
      include: expect.any(Object),
    });
  });

  it('should throw BadRequestException when players_current exceeds players_needed', async () => {
    mockPrismaService.game.findUnique.mockResolvedValue({
      id: 'game-123',
      players_current: 2,
      players_needed: 4,
    });
    mockPrismaService.gamePlayer.count.mockResolvedValue(5);

    await expect(
      service.updateGame('game-123', {
        players_needed: 4,
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'players_current cannot be greater than players_needed',
      ),
    );
  });

  it('should throw NotFoundException when creator does not exist', async () => {
    mockPrismaService.game.findUnique.mockResolvedValue({
      id: 'game-123',
      players_current: 2,
      players_needed: 4,
    });
    mockPrismaService.gamePlayer.count.mockResolvedValue(2);
    mockPrismaService.user.findFirst.mockResolvedValue(null);

    await expect(
      service.updateGame('game-123', { creator_id: 'missing-user' }),
    ).rejects.toThrow(new NotFoundException('Creator not found'));
  });
});