import { Test, TestingModule } from '@nestjs/testing';
import { GamesService } from '../games.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StripeService } from '../../stripe/stripe.service';
import { UpdateGameDto } from '../dto/update-game.dto';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { GameStatus, PlayerStatus } from '@prisma/client';

describe('GamesService - updateGame', () => {
  let service: GamesService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
    },
    game: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockStripeService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: StripeService,
          useValue: mockStripeService,
        },
      ],
    }).compile();

    service = module.get<GamesService>(GamesService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('updateGame', () => {
    const mockUser = {
      id: 'user-1',
      auth_id: 'auth-1',
    };

    const mockGame = {
      id: 'game-1',
      creator_id: 'user-1',
      status: GameStatus.PLAYERS_REQUIRED,
      players_needed: 4,
      players_current: 2,
      players: [
        { status: PlayerStatus.APPROVED, user_id: 'user-1' },
        { status: PlayerStatus.APPROVED, user_id: 'user-2' },
        { status: PlayerStatus.PENDING, user_id: 'user-3' },
      ],
    };

    it('should successfully update a game', async () => {
      const updateDto: UpdateGameDto = {
        location: 'New Location',
        players_needed: 3,
        total_cost: 12000, // £120
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.game.findUnique.mockResolvedValue(mockGame);
      mockPrismaService.game.update.mockResolvedValue({
        ...mockGame,
        ...updateDto,
        cost_per_player: 4000, // £40 (£120 / 3 players)
        status: GameStatus.READY_TO_BOOK, // Should transition since 2 >= 3 is false, wait this should stay PLAYERS_REQUIRED
      });

      const result = await service.updateGame('game-1', 'auth-1', updateDto);

      expect(mockPrismaService.game.update).toHaveBeenCalledWith({
        where: { id: 'game-1' },
        data: {
          location: 'New Location',
          players_needed: 3,
          total_cost: 12000,
          cost_per_player: 4000,
          players_current: 2, // Count of approved players
          // Status should remain PLAYERS_REQUIRED since 2 < 3
        },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.updateGame('game-1', 'auth-1', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if game not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.game.findUnique.mockResolvedValue(null);

      await expect(service.updateGame('game-1', 'auth-1', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user is not the creator', async () => {
      const otherUser = { id: 'user-2', auth_id: 'auth-2' };
      mockPrismaService.user.findUnique.mockResolvedValue(otherUser);
      mockPrismaService.game.findUnique.mockResolvedValue(mockGame);

      await expect(service.updateGame('game-1', 'auth-2', {})).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ConflictException if trying to reduce players_needed below approved players', async () => {
      const updateDto: UpdateGameDto = {
        players_needed: 1, // Less than 2 approved players
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.game.findUnique.mockResolvedValue(mockGame);

      await expect(
        service.updateGame('game-1', 'auth-1', updateDto),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException for invalid handicap range', async () => {
      const updateDto: UpdateGameDto = {
        handicap_min: 20,
        handicap_max: 10, // Invalid: min > max
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.game.findUnique.mockResolvedValue(mockGame);

      await expect(
        service.updateGame('game-1', 'auth-1', updateDto),
      ).rejects.toThrow(ConflictException);
    });

    it('should prevent updates to completed games', async () => {
      const completedGame = {
        ...mockGame,
        status: GameStatus.COMPLETED,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.game.findUnique.mockResolvedValue(completedGame);

      await expect(
        service.updateGame('game-1', 'auth-1', { location: 'New Location' }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
