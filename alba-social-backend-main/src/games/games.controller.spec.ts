import { Test, TestingModule } from '@nestjs/testing';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';
import { FirebaseAuthGuard } from '../guards/firebase-auth.guard';
import { HttpException, HttpStatus } from '@nestjs/common';
import { CanActivate } from '@nestjs/common';

describe('GamesController', () => {
  let controller: GamesController;
  let service: GamesService;

  const mockGamesService = {
    getGamePaymentDetails: jest.fn(),
    createGamePaymentIntent: jest.fn(),
    getUserByAuthId: jest.fn(),
    processGamePayout: jest.fn(),
  };

  const mockFirebaseAuthGuard: CanActivate = {
    canActivate: jest.fn(() => true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GamesController],
      providers: [
        {
          provide: GamesService,
          useValue: mockGamesService,
        },
      ],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue(mockFirebaseAuthGuard)
      .compile();

    controller = module.get<GamesController>(GamesController);
    service = module.get<GamesService>(GamesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getGamePaymentDetails', () => {
    it('should return payment details from the service', async () => {
      const gameId = 'test-game-id';
      const authId = 'test-user-id';
      const expectedDetails = {
        playerShare: 5000,
        applicationFee: 500,
        totalAmount: 5500,
        currency: 'gbp',
      };
      mockGamesService.getGamePaymentDetails.mockResolvedValue(expectedDetails);

      const result = await controller.getGamePaymentDetails(
        { user: { uid: authId } },
        gameId,
      );

      expect(result).toEqual(expectedDetails);
      expect(service.getGamePaymentDetails).toHaveBeenCalledWith(
        authId,
        gameId,
      );
    });

    it('should handle service errors gracefully', async () => {
      const gameId = 'test-game-id';
      const authId = 'test-user-id';
      mockGamesService.getGamePaymentDetails.mockRejectedValue(
        new Error('Service Error'),
      );

      await expect(
        controller.getGamePaymentDetails({ user: { uid: authId } }, gameId),
      ).rejects.toThrow(
        new HttpException(
          'Failed to get payment details',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    });
  });

  describe('createGamePaymentIntent', () => {
    it('should return payment intent info from the service', async () => {
      const gameId = 'test-game-id';
      const authId = 'test-user-id';
      const expectedResponse = { clientSecret: 'pi_123' };
      mockGamesService.createGamePaymentIntent.mockResolvedValue(
        expectedResponse,
      );

      const result = await controller.createGamePaymentIntent(
        { user: { uid: authId } },
        gameId,
      );

      expect(result).toEqual(expectedResponse);
      expect(service.createGamePaymentIntent).toHaveBeenCalledWith(
        authId,
        gameId,
      );
    });

    it('should handle service errors gracefully', async () => {
      const gameId = 'test-game-id';
      const authId = 'test-user-id';
      mockGamesService.createGamePaymentIntent.mockRejectedValue(
        new Error('Service Error'),
      );

      await expect(
        controller.createGamePaymentIntent({ user: { uid: authId } }, gameId),
      ).rejects.toThrow(
        new HttpException(
          'Failed to create payment intent for game',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    });
  });

  describe('processPayout', () => {
    it('should process payout when user is admin', async () => {
      const gameId = 'test-game-id';
      const adminAuthId = 'admin-user-id';
      const adminUser = {
        id: 'admin-1',
        auth_id: adminAuthId,
        admin_status: true,
      };
      const expectedResponse = {
        payout_completed: true,
        stripe_payout: { id: 'po_123' },
      };

      mockGamesService.getUserByAuthId.mockResolvedValue(adminUser);
      mockGamesService.processGamePayout.mockResolvedValue(expectedResponse);

      const result = await controller.processPayout(
        { user: { uid: adminAuthId } },
        gameId,
      );

      expect(result).toEqual(expectedResponse);
      expect(service.getUserByAuthId).toHaveBeenCalledWith(adminAuthId);
      expect(service.processGamePayout).toHaveBeenCalledWith(
        gameId,
        adminAuthId,
      );
    });

    it('should throw ForbiddenException when user is not admin', async () => {
      const gameId = 'test-game-id';
      const nonAdminAuthId = 'non-admin-user-id';
      const nonAdminUser = {
        id: 'user-1',
        auth_id: nonAdminAuthId,
        admin_status: false,
      };

      mockGamesService.getUserByAuthId.mockResolvedValue(nonAdminUser);

      await expect(
        controller.processPayout({ user: { uid: nonAdminAuthId } }, gameId),
      ).rejects.toThrow('Only admins can process payouts');
    });

    it('should throw NotFoundException when user is not found', async () => {
      const gameId = 'test-game-id';
      const invalidAuthId = 'invalid-user-id';

      mockGamesService.getUserByAuthId.mockRejectedValue(
        new Error('User not found'),
      );

      await expect(
        controller.processPayout({ user: { uid: invalidAuthId } }, gameId),
      ).rejects.toThrow('User not found');
    });

    it('should handle service errors gracefully', async () => {
      const gameId = 'test-game-id';
      const adminAuthId = 'admin-user-id';
      const adminUser = {
        id: 'admin-1',
        auth_id: adminAuthId,
        admin_status: true,
      };

      mockGamesService.getUserByAuthId.mockResolvedValue(adminUser);
      mockGamesService.processGamePayout.mockRejectedValue(
        new Error('Service Error'),
      );

      await expect(
        controller.processPayout({ user: { uid: adminAuthId } }, gameId),
      ).rejects.toThrow('Service Error');
    });
  });
});
