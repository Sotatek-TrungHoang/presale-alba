import { Test, TestingModule } from '@nestjs/testing';
import { GamesService } from '../games.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StripeService } from '../../stripe/stripe.service';
import { ConflictException } from '@nestjs/common';
import { GameStatus, PaymentStatus, ComplaintStatus } from '@prisma/client';
import { NotificationsService } from 'src/notifications/notifications.service';

// Mock the PrismaService
const mockPrismaService = {
  game: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  gamePlayer: {
    update: jest.fn(),
  },
};

// Mock the StripeService
const mockStripeService = {
  createPaymentIntent: jest.fn(),
  createManualPayout: jest.fn(),
};

// Mock the NotificationsService
const mockNotificationsService = {
  createPaymentConfirmationNotification: jest.fn(),
  createAllPlayersPaidNotification: jest.fn(),
  sendNotificationToUser: jest.fn(),
};

describe('GamesService - Payout with Complaints', () => {
  let service: GamesService;

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
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    service = module.get<GamesService>(GamesService);
    jest.clearAllMocks();
  });

  describe('processGamePayout', () => {
    const adminAuthId = 'admin-123';
    const gameId = 'game-id';

    it('should block payout when there are unresolved complaints', async () => {
      // Mock game with unresolved complaints
      const mockGame = {
        id: gameId,
        status: 'COMPLETED' as GameStatus,
        payment_status: 'FULLY_PAID' as PaymentStatus,
        payout_completed: false,
        Complaint: [
          {
            id: 'complaint-1',
            status: 'PENDING' as ComplaintStatus,
            deleted_at: null,
          },
        ],
      };

      // Setup mocks
      mockPrismaService.game.findUnique.mockResolvedValue(mockGame);

      // Call the method and expect error
      await expect(
        service.processGamePayout(gameId, adminAuthId),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.processGamePayout(gameId, adminAuthId),
      ).rejects.toThrow(
        'There are unresolved complaints for this game. Payout is on hold.',
      );
    });

    it('should process payout successfully when no complaints exist', async () => {
      // Mock game with no complaints and creator with Stripe account
      const mockGame = {
        id: gameId,
        status: 'COMPLETED' as GameStatus,
        payment_status: 'FULLY_PAID' as PaymentStatus,
        payout_completed: false,
        cost_per_player: 5000,
        Complaint: [],
        creator: {
          id: 'creator-123',
          stripe_account: {
            stripe_connect_id: 'acct_123',
          },
        },
        players: [
          { payment_amount: 5000, has_paid: true, refunded: false },
          { payment_amount: 5000, has_paid: true, refunded: false },
          { payment_amount: 3000, has_paid: false, refunded: true }, // Refunded player
        ],
      };

      // Setup mocks
      mockPrismaService.game.findUnique.mockResolvedValue(mockGame);
      mockPrismaService.game.update.mockResolvedValue({
        ...mockGame,
        payout_completed: true,
        payout_date: expect.any(Date),
        stripe_payout: {
          id: 'po_123',
          status: 'pending',
          amount: 10000,
        },
      });

      mockStripeService.createManualPayout.mockResolvedValue({
        id: 'po_123',
        status: 'pending',
        amount: 10000,
      });

      // Call the method
      const result = await service.processGamePayout(gameId, adminAuthId);

      // Assertions
      expect(result.payout_completed).toBe(true);
      expect(mockStripeService.createManualPayout).toHaveBeenCalledWith(
        adminAuthId,
        {
          amount: 10000, // Only includes non-refunded players (5000 + 5000)
          currency: 'gbp',
          connectedAccountId: 'acct_123',
          description: `Payout for completed game: ${gameId}`,
          metadata: {
            game_id: gameId,
            creator_user_id: 'creator-123',
            player_count: '2', // Only counts non-refunded players
            total_amount: '10000',
          },
        },
      );
      expect(result.stripe_payout).toEqual({
        id: 'po_123',
        status: 'pending',
        amount: 10000,
      });
    });

    it('should exclude refunded players from payout calculation', async () => {
      // Mock game with refunded players
      const mockGame = {
        id: gameId,
        status: 'COMPLETED' as GameStatus,
        payment_status: 'FULLY_PAID' as PaymentStatus,
        payout_completed: false,
        cost_per_player: 5000,
        Complaint: [],
        creator: {
          id: 'creator-123',
          stripe_account: {
            stripe_connect_id: 'acct_123',
          },
        },
        players: [
          { payment_amount: 5000, has_paid: true, refunded: false },
          { payment_amount: 3000, has_paid: false, refunded: true }, // Refunded player
          { payment_amount: 2000, has_paid: true, refunded: false },
        ],
      };

      // Setup mocks
      mockPrismaService.game.findUnique.mockResolvedValue(mockGame);
      mockPrismaService.game.update.mockResolvedValue({
        ...mockGame,
        payout_completed: true,
        payout_date: expect.any(Date),
        stripe_payout: {
          id: 'po_123',
          status: 'pending',
          amount: 7000,
        },
      });

      mockStripeService.createManualPayout.mockResolvedValue({
        id: 'po_123',
        status: 'pending',
        amount: 10000, // 5000 + 5000 (both non-refunded players have paid, so 2 * cost_per_player)
      });

      // Call the method
      const result = await service.processGamePayout(gameId, adminAuthId);

      // Assertions
      expect(result.payout_completed).toBe(true);
      expect(mockStripeService.createManualPayout).toHaveBeenCalledWith(
        adminAuthId,
        {
          amount: 10000, // Only includes non-refunded players (5000 * 2)
          currency: 'gbp',
          connectedAccountId: 'acct_123',
          description: `Payout for completed game: ${gameId}`,
          metadata: {
            game_id: gameId,
            creator_user_id: 'creator-123',
            player_count: '2', // Only counts non-refunded players
            total_amount: '10000',
          },
        },
      );
    });

    it('should throw error if creator has no Stripe account', async () => {
      // Mock game with creator without Stripe account
      const mockGame = {
        id: gameId,
        status: 'COMPLETED' as GameStatus,
        payment_status: 'FULLY_PAID' as PaymentStatus,
        payout_completed: false,
        Complaint: [],
        creator: {
          id: 'creator-123',
          stripe_account: null,
        },
        players: [],
      };

      // Setup mocks
      mockPrismaService.game.findUnique.mockResolvedValue(mockGame);

      // Call the method and expect error
      await expect(
        service.processGamePayout(gameId, adminAuthId),
      ).rejects.toThrow(
        'Game creator does not have a Stripe account set up for payouts',
      );
    });

    it('should throw error if no payments found', async () => {
      // Mock game with no player payments
      const mockGame = {
        id: gameId,
        status: 'COMPLETED' as GameStatus,
        payment_status: 'FULLY_PAID' as PaymentStatus,
        payout_completed: false,
        cost_per_player: 5000,
        Complaint: [],
        creator: {
          id: 'creator-123',
          stripe_account: {
            stripe_connect_id: 'acct_123',
          },
        },
        players: [], // No players with payments
      };

      // Setup mocks
      mockPrismaService.game.findUnique.mockResolvedValue(mockGame);
      mockPrismaService.game.update.mockResolvedValue({
        ...mockGame,
        payout_completed: true,
        payout_date: expect.any(Date),
        stripe_payout: null,
      });

      // Call the method and expect it to complete but return null payout
      const result = await service.processGamePayout(gameId, adminAuthId);
      expect(result.stripe_payout).toBeNull();
    });

    it('should handle Stripe payout errors gracefully', async () => {
      // Mock game with valid setup
      const mockGame = {
        id: gameId,
        status: 'COMPLETED' as GameStatus,
        payment_status: 'FULLY_PAID' as PaymentStatus,
        payout_completed: false,
        Complaint: [],
        creator: {
          id: 'creator-123',
          stripe_account: {
            stripe_connect_id: 'acct_123',
          },
        },
        players: [{ payment_amount: 5000, has_paid: true }],
      };

      // Setup mocks
      mockPrismaService.game.findUnique.mockResolvedValue(mockGame);
      mockStripeService.createManualPayout.mockRejectedValue(
        new Error('Stripe payout failed'),
      );

      // Call the method and expect error
      await expect(
        service.processGamePayout(gameId, adminAuthId),
      ).rejects.toThrow('Failed to process payout: Stripe payout failed');
    });

    it('should throw NotFoundException when game does not exist', async () => {
      // Setup mocks
      mockPrismaService.game.findUnique.mockResolvedValue(null);

      // Call the method and expect error
      await expect(
        service.processGamePayout(gameId, adminAuthId),
      ).rejects.toThrow('Game not found');
    });

    it('should throw error when game is not completed', async () => {
      // Mock game that is not completed
      const mockGame = {
        id: gameId,
        status: 'READY' as GameStatus,
        payment_status: 'FULLY_PAID' as PaymentStatus,
        payout_completed: false,
        Complaint: [],
        creator: {
          id: 'creator-123',
          stripe_account: {
            stripe_connect_id: 'acct_123',
          },
        },
        players: [],
      };

      // Setup mocks
      mockPrismaService.game.findUnique.mockResolvedValue(mockGame);

      // Call the method and expect error
      await expect(
        service.processGamePayout(gameId, adminAuthId),
      ).rejects.toThrow('Game must be completed before processing payout');
    });

    it('should throw error when payment status is not FULLY_PAID', async () => {
      // Mock game with incomplete payments
      const mockGame = {
        id: gameId,
        status: 'COMPLETED' as GameStatus,
        payment_status: 'PARTIALLY_PAID' as PaymentStatus,
        payout_completed: false,
        Complaint: [],
        creator: {
          id: 'creator-123',
          stripe_account: {
            stripe_connect_id: 'acct_123',
          },
        },
        players: [
          { payment_amount: 5000, has_paid: true, refunded: false },
          { payment_amount: 5000, has_paid: false, refunded: false }, // This player hasn't paid
        ],
      };

      // Setup mocks
      mockPrismaService.game.findUnique.mockResolvedValue(mockGame);

      // Call the method and expect error
      await expect(
        service.processGamePayout(gameId, adminAuthId),
      ).rejects.toThrow(
        'All non-refunded players must pay before processing payout',
      );
    });

    it('should allow payout when some players are refunded but all non-refunded players have paid', async () => {
      // Mock game with some refunded players but all non-refunded players paid
      const mockGame = {
        id: gameId,
        status: 'COMPLETED' as GameStatus,
        payment_status: 'PARTIALLY_PAID' as PaymentStatus, // Status can be PARTIALLY_PAID due to refunds
        payout_completed: false,
        cost_per_player: 5000,
        Complaint: [],
        creator: {
          id: 'creator-123',
          stripe_account: {
            stripe_connect_id: 'acct_123',
          },
        },
        players: [
          { payment_amount: 5000, has_paid: true, refunded: false },
          { payment_amount: 5000, has_paid: true, refunded: true }, // This player is refunded
        ],
      };

      // Setup mocks
      mockPrismaService.game.findUnique.mockResolvedValue(mockGame);
      mockPrismaService.game.update.mockResolvedValue({
        ...mockGame,
        payout_completed: true,
        payout_date: new Date(),
        stripe_payout: {
          id: 'po_123',
          status: 'pending',
          amount: 5000,
        },
      });
      mockStripeService.createManualPayout.mockResolvedValue({
        id: 'po_123',
        status: 'pending',
        amount: 5000,
      });

      // Call the method
      const result = await service.processGamePayout(gameId, adminAuthId);

      // Assertions
      expect(result.payout_completed).toBe(true);
      expect(mockStripeService.createManualPayout).toHaveBeenCalledWith(
        adminAuthId,
        {
          amount: 5000, // Only the non-refunded player's payment
          currency: 'gbp',
          connectedAccountId: 'acct_123',
          description: `Payout for completed game: ${gameId}`,
          metadata: {
            game_id: gameId,
            creator_user_id: 'creator-123',
            player_count: '1', // Only 1 non-refunded, paid player
            total_amount: '5000',
          },
        },
      );
    });

    it('should throw error when non-refunded players have not paid', async () => {
      // Mock game with some refunded players and some non-refunded players who haven't paid
      const mockGame = {
        id: gameId,
        status: 'COMPLETED' as GameStatus,
        payment_status: 'PARTIALLY_PAID' as PaymentStatus,
        payout_completed: false,
        Complaint: [],
        creator: {
          id: 'creator-123',
          stripe_account: {
            stripe_connect_id: 'acct_123',
          },
        },
        players: [
          { payment_amount: 5000, has_paid: false, refunded: false }, // This player hasn't paid
          { payment_amount: 5000, has_paid: true, refunded: true }, // This player is refunded
        ],
      };

      // Setup mocks
      mockPrismaService.game.findUnique.mockResolvedValue(mockGame);

      // Call the method and expect error
      await expect(
        service.processGamePayout(gameId, adminAuthId),
      ).rejects.toThrow(
        'All non-refunded players must pay before processing payout',
      );
    });

    it('should throw error when payout has already been processed', async () => {
      // Mock game with payout already completed
      const mockGame = {
        id: gameId,
        status: 'COMPLETED' as GameStatus,
        payment_status: 'FULLY_PAID' as PaymentStatus,
        payout_completed: true,
        Complaint: [],
        creator: {
          id: 'creator-123',
          stripe_account: {
            stripe_connect_id: 'acct_123',
          },
        },
        players: [],
      };

      // Setup mocks
      mockPrismaService.game.findUnique.mockResolvedValue(mockGame);

      // Call the method and expect error
      await expect(
        service.processGamePayout(gameId, adminAuthId),
      ).rejects.toThrow('Payout has already been processed');
    });

    it('should throw error when creator has no Stripe account', async () => {
      // Mock game with creator without Stripe account
      const mockGame = {
        id: gameId,
        status: 'COMPLETED' as GameStatus,
        payment_status: 'FULLY_PAID' as PaymentStatus,
        payout_completed: false,
        Complaint: [],
        creator: {
          id: 'creator-123',
          stripe_account: null,
        },
        players: [{ payment_amount: 5000, has_paid: true, refunded: false }],
      };

      // Setup mocks
      mockPrismaService.game.findUnique.mockResolvedValue(mockGame);

      // Call the method and expect error
      await expect(
        service.processGamePayout(gameId, adminAuthId),
      ).rejects.toThrow(
        'Game creator does not have a Stripe account set up for payouts',
      );
    });

    it('should throw error when all players are refunded', async () => {
      // Mock game with all players refunded
      const mockGame = {
        id: gameId,
        status: 'COMPLETED' as GameStatus,
        payment_status: 'FULLY_PAID' as PaymentStatus,
        payout_completed: false,
        cost_per_player: 5000,
        Complaint: [],
        creator: {
          id: 'creator-123',
          stripe_account: {
            stripe_connect_id: 'acct_123',
          },
        },
        players: [
          { payment_amount: 5000, has_paid: false, refunded: true },
          { payment_amount: 3000, has_paid: false, refunded: true },
        ],
      };

      // Setup mocks
      mockPrismaService.game.findUnique.mockResolvedValue(mockGame);
      mockPrismaService.game.update.mockResolvedValue({
        ...mockGame,
        payout_completed: true,
        payout_date: expect.any(Date),
        stripe_payout: null,
      });

      // Call the method - should complete without throwing since no non-refunded players exist
      const result = await service.processGamePayout(gameId, adminAuthId);

      // Assertions
      expect(result.payout_completed).toBe(true);
      expect(result.stripe_payout).toBeNull();
    });

    it('should throw error when all players have payment_amount of 0', async () => {
      // Mock game with players having 0 payment amounts
      const mockGame = {
        id: gameId,
        status: 'COMPLETED' as GameStatus,
        payment_status: 'FULLY_PAID' as PaymentStatus,
        payout_completed: false,
        cost_per_player: 0,
        Complaint: [],
        creator: {
          id: 'creator-123',
          stripe_account: {
            stripe_connect_id: 'acct_123',
          },
        },
        players: [
          { payment_amount: 0, has_paid: true, refunded: false },
          { payment_amount: 0, has_paid: true, refunded: false },
        ],
      };

      // Setup mocks
      mockPrismaService.game.findUnique.mockResolvedValue(mockGame);
      mockPrismaService.game.update.mockResolvedValue({
        ...mockGame,
        payout_completed: true,
        payout_date: expect.any(Date),
        stripe_payout: null,
      });

      // Call the method - should complete without throwing since total payout is 0
      const result = await service.processGamePayout(gameId, adminAuthId);

      // Assertions
      expect(result.payout_completed).toBe(true);
      expect(result.stripe_payout).toBeNull();
    });

    it('should handle mixed refunded and non-refunded players correctly', async () => {
      // Mock game with mixed refunded and non-refunded players
      const mockGame = {
        id: gameId,
        status: 'COMPLETED' as GameStatus,
        payment_status: 'FULLY_PAID' as PaymentStatus,
        payout_completed: false,
        cost_per_player: 5000,
        Complaint: [],
        creator: {
          id: 'creator-123',
          stripe_account: {
            stripe_connect_id: 'acct_123',
          },
        },
        players: [
          { payment_amount: 5000, has_paid: true, refunded: false },
          { payment_amount: 3000, has_paid: false, refunded: true }, // Refunded
          { payment_amount: 2000, has_paid: true, refunded: false },
          { payment_amount: 1000, has_paid: false, refunded: true }, // Refunded
          { payment_amount: 4000, has_paid: true, refunded: false },
        ],
      };

      // Setup mocks
      mockPrismaService.game.findUnique.mockResolvedValue(mockGame);
      mockPrismaService.game.update.mockResolvedValue({
        ...mockGame,
        payout_completed: true,
        payout_date: expect.any(Date),
        stripe_payout: {
          id: 'po_123',
          status: 'pending',
          amount: 11000,
        },
      });

      mockStripeService.createManualPayout.mockResolvedValue({
        id: 'po_123',
        status: 'pending',
        amount: 15000, // 5000 * 3 (3 non-refunded players with has_paid=true)
      });

      // Call the method
      const result = await service.processGamePayout(gameId, adminAuthId);

      // Assertions
      expect(result.payout_completed).toBe(true);
      expect(mockStripeService.createManualPayout).toHaveBeenCalledWith(
        adminAuthId,
        {
          amount: 15000, // Only includes non-refunded players (5000 * 3)
          currency: 'gbp',
          connectedAccountId: 'acct_123',
          description: `Payout for completed game: ${gameId}`,
          metadata: {
            game_id: gameId,
            creator_user_id: 'creator-123',
            player_count: '3', // Only counts non-refunded players
            total_amount: '15000',
          },
        },
      );
    });
  });

  describe('processPlayerPayment', () => {
    const gameId = 'game-id';
    const playerId = 'player-id';
    const paymentIntentId = 'payment-intent-id';
    const amount = 5000;

    it('should process player payment successfully', async () => {
      // Mock game with players
      const mockGame = {
        id: gameId,
        players: [
          { id: 'player1', user_id: playerId, has_paid: false },
          { id: 'player2', user_id: 'other-player', has_paid: true },
        ],
      };

      const mockUpdatedGame = {
        ...mockGame,
        players: [
          { id: 'player1', user_id: playerId, has_paid: true },
          { id: 'player2', user_id: 'other-player', has_paid: true },
        ],
      };

      // Setup mocks
      mockPrismaService.game.findUnique
        .mockResolvedValueOnce(mockGame)
        .mockResolvedValueOnce(mockUpdatedGame);

      mockPrismaService.gamePlayer = {
        update: jest.fn().mockResolvedValue({
          id: 'player1',
          has_paid: true,
          payment_amount: amount,
          payment_date: expect.any(Date),
          stripe_payment_id: paymentIntentId,
        }),
      };

      mockPrismaService.game.update.mockResolvedValue({
        id: gameId,
        payment_status: 'FULLY_PAID',
      });

      // Mock findOne to return complete game data
      jest.spyOn(service, 'findOne').mockResolvedValue({
        id: gameId,
        payment_status: 'FULLY_PAID',
        players: mockUpdatedGame.players,
      } as any);

      // Call the method
      await service.processPlayerPayment(
        gameId,
        playerId,
        paymentIntentId,
        amount,
      );

      // Assertions
      expect(mockPrismaService.gamePlayer.update).toHaveBeenCalledWith({
        where: { id: 'player1' },
        data: {
          has_paid: true,
          payment_amount: amount,
          payment_date: expect.any(Date),
          stripe_payment_id: paymentIntentId,
        },
      });
      expect(mockPrismaService.game.update).toHaveBeenCalledWith({
        where: { id: gameId },
        data: {
          payment_status: 'FULLY_PAID',
        },
      });
    });

    it('should throw NotFoundException when game not found', async () => {
      // Setup mocks
      mockPrismaService.game.findUnique.mockResolvedValue(null);

      // Call the method and expect error
      await expect(
        service.processPlayerPayment(gameId, playerId, paymentIntentId, amount),
      ).rejects.toThrow('Game not found');
    });

    it('should throw NotFoundException when player not found in game', async () => {
      // Mock game without the player
      const mockGame = {
        id: gameId,
        players: [{ id: 'player2', user_id: 'other-player', has_paid: false }],
      };

      // Setup mocks
      mockPrismaService.game.findUnique.mockResolvedValue(mockGame);

      // Call the method and expect error
      await expect(
        service.processPlayerPayment(gameId, playerId, paymentIntentId, amount),
      ).rejects.toThrow('Player not found in this game');
    });
  });
});
