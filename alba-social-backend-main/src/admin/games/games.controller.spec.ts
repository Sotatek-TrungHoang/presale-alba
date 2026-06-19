import { Test, TestingModule } from '@nestjs/testing';
import { AdminGamesController } from './games.controller';
import { GamesService } from '../../games/games.service';
import { FirebaseAuthGuard } from '../../guards/firebase-auth.guard';
import { AdminGuard } from '../../guards/admin.guard';
import { FirebaseService } from '../../firebase/firebase.service';
import { AdminGamesService } from './games.service';

describe('AdminGamesController', () => {
  let controller: AdminGamesController;
  let gamesService: GamesService;

  const mockGamesService = {
    findAllPaginated: jest.fn(),
    findOne: jest.fn(),
    getNearbyUsersForGame: jest.fn(),
  };

  const mockAdminGamesService = {
    createGame: jest.fn(),
    deleteGame: jest.fn(),
    updateGame: jest.fn(),
    addPlayerToGame: jest.fn(),
    updateGamePlayerStatus: jest.fn(),
    removePlayerFromGame: jest.fn(),
    notifyNearbyUsers: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminGamesController],
      providers: [
        {
          provide: GamesService,
          useValue: mockGamesService,
        },
        {
          provide: AdminGamesService,
          useValue: mockAdminGamesService,
        },
        {
          provide: FirebaseService,
          useValue: {
            verifyIdToken: jest
              .fn()
              .mockResolvedValue({ uid: 'test-admin-auth-id' }),
          },
        },
      ],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue({
        canActivate: jest.fn().mockImplementation(() => true),
      })
      .overrideGuard(AdminGuard)
      .useValue({
        canActivate: jest.fn().mockImplementation(() => true),
      })
      .compile();

    controller = module.get<AdminGamesController>(AdminGamesController);
    gamesService = module.get<GamesService>(GamesService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAllPaginated', () => {
    it('should call gamesService.findAllPaginated with provided parameters', async () => {
      const paginateDto = { page: 2, limit: 20 };
      const expectedResult = {
        data: [],
        pagination: { page: 2, limit: 20, total: 0, totalPages: 0 },
      };
      mockGamesService.findAllPaginated.mockResolvedValue(expectedResult);

      const result = await controller.findAllPaginated(paginateDto);

      expect(mockGamesService.findAllPaginated).toHaveBeenCalledWith(
        paginateDto,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('findOne', () => {
    it('should call gamesService.findOne with provided game id', async () => {
      const gameId = 'game-123';
      const expectedResult = {
        id: gameId,
        status: 'READY',
        players_current: 2,
        players_needed: 4,
      };
      mockGamesService.findOne.mockResolvedValue(expectedResult);

      const result = await controller.findOne(gameId);

      expect(mockGamesService.findOne).toHaveBeenCalledWith(gameId);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getNearbyUsersForGame', () => {
    it('should default the radius to 10km when not provided', async () => {
      const gameId = 'game-123';
      const expectedResult = [
        { id: 'user-1', distanceKm: 1.2 },
        { id: 'user-2', distanceKm: 4.8 },
      ];

      mockGamesService.getNearbyUsersForGame.mockResolvedValue(expectedResult);

      const result = await controller.getNearbyUsersForGame(gameId);

      expect(mockGamesService.getNearbyUsersForGame).toHaveBeenCalledWith(
        gameId,
        10,
      );
      expect(result).toEqual(expectedResult);
    });

    it('should cap the radius at 100km when a larger value is provided', async () => {
      const gameId = 'game-123';
      mockGamesService.getNearbyUsersForGame.mockResolvedValue([]);

      await controller.getNearbyUsersForGame(gameId, '150');

      expect(mockGamesService.getNearbyUsersForGame).toHaveBeenCalledWith(
        gameId,
        100,
      );
    });
  });

  describe('notifyNearbyUsers', () => {
    it('should call adminGamesService.notifyNearbyUsers with the game id and user ids', async () => {
      const gameId = 'game-123';
      const dto = { user_ids: ['user-1', 'user-2'] };
      const expectedResult = {
        success: true,
        notifiedCount: 2,
        notifiedUserIds: dto.user_ids,
      };

      mockAdminGamesService.notifyNearbyUsers.mockResolvedValue(expectedResult);

      const result = await controller.notifyNearbyUsers(gameId, dto as any);

      expect(mockAdminGamesService.notifyNearbyUsers).toHaveBeenCalledWith(
        gameId,
        dto.user_ids,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('updateGame', () => {
    it('should call adminGamesService.updateGame with provided game id and dto', async () => {
      const gameId = 'game-123';
      const updateDto = {
        players_current: 4,
        players_needed: 4,
      };
      const expectedResult = {
        id: gameId,
        ...updateDto,
      };

      mockAdminGamesService.updateGame.mockResolvedValue(expectedResult);

      const result = await controller.updateGame(gameId, updateDto);

      expect(mockAdminGamesService.updateGame).toHaveBeenCalledWith(
        gameId,
        updateDto,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('deleteGame', () => {
    it('should call adminGamesService.deleteGame with provided game id', async () => {
      const gameId = 'game-123';
      const expectedResult = {
        id: gameId,
        deleted_at: new Date('2026-05-06T10:00:00.000Z'),
      };

      mockAdminGamesService.deleteGame.mockResolvedValue(expectedResult);

      const result = await controller.deleteGame(gameId);

      expect(mockAdminGamesService.deleteGame).toHaveBeenCalledWith(gameId);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('createGame', () => {
    it('should call adminGamesService.createGame with provided dto', async () => {
      const req = { user: { uid: 'test-admin-auth-id' } };
      const createDto = {
        date: '2026-05-01T10:00:00.000Z',
        time_slot: 'LATE_MORNING',
        players_needed: 4,
        game_type: 'RELAXED_ROUND',
      };
      const expectedResult = {
        id: 'game-123',
        status: 'PLAYERS_REQUIRED',
      };

      mockAdminGamesService.createGame.mockResolvedValue(expectedResult);

      const result = await controller.createGame(req as any, createDto as any);

      expect(mockAdminGamesService.createGame).toHaveBeenCalledWith(
        req.user.uid,
        createDto,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('addPlayerToGame', () => {
    it('should call adminGamesService.addPlayerToGame with game id and user id', async () => {
      const gameId = 'game-123';
      const dto = { user_id: 'user-456' };
      const expectedResult = {
        id: gameId,
        players: [{ user_id: 'user-456', status: 'PENDING' }],
      };

      mockAdminGamesService.addPlayerToGame.mockResolvedValue(expectedResult);

      const result = await controller.addPlayerToGame(gameId, dto);

      expect(mockAdminGamesService.addPlayerToGame).toHaveBeenCalledWith(
        gameId,
        dto.user_id,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('removePlayerFromGame', () => {
    it('should call adminGamesService.removePlayerFromGame with game id and user id', async () => {
      const gameId = 'game-123';
      const userId = 'user-456';
      const expectedResult = {
        id: gameId,
        players_current: 2,
        status: 'PLAYERS_REQUIRED',
      };

      mockAdminGamesService.removePlayerFromGame.mockResolvedValue(
        expectedResult,
      );

      const result = await controller.removePlayerFromGame(gameId, userId);

      expect(mockAdminGamesService.removePlayerFromGame).toHaveBeenCalledWith(
        gameId,
        userId,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('updateGamePlayerStatus', () => {
    it('should call adminGamesService.updateGamePlayerStatus with game id, user id and status', async () => {
      const gameId = 'game-123';
      const userId = 'user-456';
      const dto = { status: 'APPROVED' };
      const expectedResult = {
        id: gameId,
        players_current: 3,
        status: 'PLAYERS_REQUIRED',
      };

      mockAdminGamesService.updateGamePlayerStatus.mockResolvedValue(
        expectedResult,
      );

      const result = await controller.updateGamePlayerStatus(
        gameId,
        userId,
        dto as any,
      );

      expect(mockAdminGamesService.updateGamePlayerStatus).toHaveBeenCalledWith(
        gameId,
        userId,
        dto.status,
      );
      expect(result).toEqual(expectedResult);
    });
  });
});
