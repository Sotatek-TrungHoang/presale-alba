import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { PlayerStatus, ComplaintType, ComplaintStatus } from '@prisma/client';
import { ComplaintsService } from './complaints.service';
import { StripeService } from '../stripe/stripe.service';
import { NotificationsService } from '../notifications/notifications.service';

// --- Mock PrismaService ---
const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  game: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  complaint: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  gamePlayer: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
};

const mockStripeService = {
  createRefund: jest.fn(),
};

const mockNotificationsService = {
  sendNotification: jest.fn(),
  createNotification: jest.fn(),
};

describe('ComplaintsService', () => {
  let service: ComplaintsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComplaintsService,
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

    service = module.get<ComplaintsService>(ComplaintsService);
    jest.clearAllMocks();
  });

  describe('createComplaint', () => {
    const authId = 'user-123';
    const gameId = 'game-123';
    const createComplaintDto = {
      type: ComplaintType.ORGANISER_DID_NOT_BOOK,
      description: 'No tee time was reserved by the organiser.',
    };

    const mockUser = { id: 'user-123', auth_id: 'user-123' };
    const mockGame = {
      id: gameId,
      players: [{ user_id: 'user-123', status: PlayerStatus.APPROVED }],
    };

    beforeEach(() => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.game.findUnique.mockResolvedValue(mockGame);
      mockPrismaService.complaint.create.mockResolvedValue({
        id: 'complaint-1',
        ...createComplaintDto,
      });
    });

    it('should create a complaint when the user is a valid game participant', async () => {
      const result = await service.createComplaint(
        authId,
        gameId,
        createComplaintDto,
      );
      expect(result).toBeDefined();
      expect(mockPrismaService.complaint.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user is not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      await expect(
        service.createComplaint(authId, gameId, createComplaintDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getGameComplaints', () => {
    const gameId = 'game-123';

    it('should return all complaints for a game', async () => {
      const complaints = [
        { id: 'c1', game_id: gameId, title: 'A', status: 'PENDING' },
        { id: 'c2', game_id: gameId, title: 'B', status: 'RESOLVED' },
      ];
      mockPrismaService.complaint.findMany = jest
        .fn()
        .mockResolvedValue(complaints);

      const result = await service.getGameComplaints(gameId);
      expect(result).toEqual(complaints);
      expect(mockPrismaService.complaint.findMany).toHaveBeenCalledWith({
        where: { game_id: gameId, deleted_at: null },
        orderBy: { created_at: 'asc' },
        include: {
          complainant: {
            include: {
              profile: true,
            },
          },
        },
      });
    });

    it('should return an empty array if no complaints exist', async () => {
      mockPrismaService.complaint.findMany = jest.fn().mockResolvedValue([]);
      const result = await service.getGameComplaints(gameId);
      expect(result).toEqual([]);
    });

    it('should throw NotFoundException if game does not exist', async () => {
      mockPrismaService.game.findUnique = jest.fn().mockResolvedValue(null);
      await expect(service.getGameComplaints('not-a-game')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('resolveComplaint', () => {
    const adminAuthId = 'admin-1';
    const complaintId = 'complaint-1';
    const adminUser = { id: 'admin-1', auth_id: 'admin-1', admin_status: true };
    const nonAdminUser = {
      id: 'user-2',
      auth_id: 'user-2',
      admin_status: false,
    };
    const complaint = {
      id: complaintId,
      status: 'PENDING',
      game_id: 'game-123',
      complainant_id: 'user-1',
      type: 'ORGANISER_DID_NOT_BOOK',
      description: 'No tee time was reserved by the organiser.',
    };

    beforeEach(() => {
      mockPrismaService.user.findUnique.mockReset();
      mockPrismaService.complaint.findUnique.mockReset();
      mockPrismaService.complaint.update.mockReset();
      mockPrismaService.complaint.findUnique.mockResolvedValue(complaint);
    });

    it('should allow an admin to resolve a complaint', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(adminUser);
      mockPrismaService.complaint.update.mockResolvedValue({
        ...complaint,
        status: 'RESOLVED',
        resolution: 'No action needed',
        resolved_by: adminUser.id,
      });
      const result = await service.resolveComplaint(adminAuthId, complaintId, {
        status: 'RESOLVED',
        resolution: 'No action needed',
      });
      expect(result.status).toBe('RESOLVED');
      expect(result.resolution).toBe('No action needed');
      expect(result.resolved_by).toBe(adminUser.id);
      expect(mockPrismaService.complaint.update).toHaveBeenCalledWith({
        where: { id: complaintId },
        data: {
          status: 'RESOLVED',
          resolution: 'No action needed',
          resolved_by: adminUser.id,
        },
      });
    });

    it('should throw NotFoundException if complaint does not exist', async () => {
      mockPrismaService.complaint.findUnique.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue(adminUser);
      await expect(
        service.resolveComplaint(adminAuthId, 'not-a-complaint', {
          status: 'RESOLVED',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not admin', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(nonAdminUser);
      await expect(
        service.resolveComplaint(nonAdminUser.auth_id, complaintId, {
          status: 'RESOLVED',
        }),
      ).rejects.toThrow('Only admins can resolve complaints');
    });

    it('should process refund when status is REFUNDED', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(adminUser);
      mockPrismaService.complaint.update.mockResolvedValue({
        ...complaint,
        status: 'REFUNDED',
        resolution: 'Refunded',
        resolved_by: adminUser.id,
      });

      // Mock game player with payment
      const mockGamePlayer = {
        id: 'gp-1',
        game_id: complaint.game_id,
        user_id: complaint.complainant_id,
        has_paid: true,
        stripe_payment_id: 'pi_123',
        payment_amount: 5000,
        refunded: false,
        game: {
          id: complaint.game_id,
          cost_per_player: 5000,
          course: {
            id: 'course-1',
            name: 'Test Course',
          },
        },
      };

      mockPrismaService.gamePlayer.findFirst.mockResolvedValue(mockGamePlayer);
      mockPrismaService.gamePlayer.update.mockResolvedValue({
        ...mockGamePlayer,
        refunded: true,
        refund_date: new Date(),
        has_paid: false,
      });

      // Mock game for payment status update
      const mockGame = {
        id: complaint.game_id,
        payment_status: 'FULLY_PAID',
        cost_per_player: 5000,
        course: {
          id: 'course-1',
          name: 'Test Course',
        },
        players: [
          { has_paid: false }, // After refund
          { has_paid: true },
        ],
      };
      mockPrismaService.game.findUnique.mockResolvedValue(mockGame);

      // Mock Stripe refund
      mockStripeService.createRefund.mockResolvedValue({
        id: 're_123',
        status: 'succeeded',
      });

      const result = await service.resolveComplaint(adminAuthId, complaintId, {
        status: 'REFUNDED',
        resolution: 'Refunded',
      });

      expect(result.status).toBe('REFUNDED');
      expect(mockStripeService.createRefund).toHaveBeenCalledWith(adminAuthId, {
        paymentIntentId: 'pi_123',
        reason: 'requested_by_customer',
        amount: 5000,
      });
      expect(mockPrismaService.gamePlayer.update).toHaveBeenCalledWith({
        where: { id: 'gp-1' },
        data: {
          refunded: true,
          refund_date: expect.any(Date),
          has_paid: false,
        },
      });
    });

    it('should throw error if no payment found for refund', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(adminUser);
      mockPrismaService.gamePlayer.findFirst.mockResolvedValue(null);

      await expect(
        service.resolveComplaint(adminAuthId, complaintId, {
          status: 'REFUNDED',
          resolution: 'Refunded',
        }),
      ).rejects.toThrow(
        'Cannot process refund: No payment found for this complaint',
      );
    });

    it('should throw error if payment already refunded', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(adminUser);
      mockPrismaService.gamePlayer.findFirst.mockResolvedValue({
        id: 'gp-1',
        game_id: complaint.game_id,
        user_id: complaint.complainant_id,
        has_paid: true,
        stripe_payment_id: 'pi_123',
        payment_amount: 5000,
        refunded: true, // Already refunded
      });

      await expect(
        service.resolveComplaint(adminAuthId, complaintId, {
          status: 'REFUNDED',
          resolution: 'Refunded',
        }),
      ).rejects.toThrow(
        'Cannot process refund: Payment has already been refunded',
      );
    });
  });
});
