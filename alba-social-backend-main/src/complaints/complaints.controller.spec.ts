import { Test, TestingModule } from '@nestjs/testing';
import { ComplaintsController } from './complaints.controller';
import { ComplaintsService } from './complaints.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ComplaintType, ComplaintStatus } from '@prisma/client';
import { FirebaseAuthGuard } from '../guards/firebase-auth.guard';

describe('ComplaintsController', () => {
  let controller: ComplaintsController;
  let service: ComplaintsService;

  const mockComplaintsService = {
    createComplaint: jest.fn(),
    getGameComplaints: jest.fn(),
    resolveComplaint: jest.fn(),
  };

  const mockFirebaseAuthGuard = {
    canActivate: jest.fn(() => true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ComplaintsController],
      providers: [
        {
          provide: ComplaintsService,
          useValue: mockComplaintsService,
        },
      ],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue(mockFirebaseAuthGuard)
      .compile();

    controller = module.get<ComplaintsController>(ComplaintsController);
    service = module.get<ComplaintsService>(ComplaintsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createComplaint', () => {
    it('should create a complaint', async () => {
      const mockRequest = { user: { uid: 'user-123' } };
      const gameId = 'game-123';
      const createComplaintDto = {
        type: ComplaintType.ORGANISER_DID_NOT_BOOK,
        description: 'Test description',
      };
      const expectedResult = { id: 'complaint-1', ...createComplaintDto };

      mockComplaintsService.createComplaint.mockResolvedValue(expectedResult);

      const result = await controller.createComplaint(
        mockRequest,
        gameId,
        createComplaintDto,
      );

      expect(result).toEqual(expectedResult);
      expect(service.createComplaint).toHaveBeenCalledWith(
        'user-123',
        gameId,
        createComplaintDto,
      );
    });
  });

  describe('getGameComplaints', () => {
    it('should return complaints for a game', async () => {
      const mockRequest = { user: { uid: 'user-123' } };
      const gameId = 'game-123';
      const expectedComplaints = [
        { id: 'complaint-1', description: 'Complaint 1' },
        { id: 'complaint-2', description: 'Complaint 2' },
      ];

      mockComplaintsService.getGameComplaints.mockResolvedValue(
        expectedComplaints,
      );

      const result = await controller.getGameComplaints(mockRequest, gameId);

      expect(result).toEqual(expectedComplaints);
      expect(service.getGameComplaints).toHaveBeenCalledWith(gameId);
    });
  });

  describe('resolveComplaint', () => {
    it('should allow admin to resolve a complaint', async () => {
      const mockRequest = { user: { uid: 'admin-123' } };
      const complaintId = 'complaint-123';
      const resolveDto = {
        status: ComplaintStatus.RESOLVED,
        resolution: 'Issue resolved',
      };
      const expectedResult = {
        id: complaintId,
        status: ComplaintStatus.RESOLVED,
        resolution: 'Issue resolved',
        resolved_by: 'admin-123',
      };

      mockComplaintsService.resolveComplaint.mockResolvedValue(expectedResult);

      const result = await controller.resolveComplaint(
        mockRequest,
        complaintId,
        resolveDto,
      );

      expect(result).toEqual(expectedResult);
      expect(service.resolveComplaint).toHaveBeenCalledWith(
        'admin-123',
        complaintId,
        resolveDto,
      );
    });

    it('should handle service errors', async () => {
      const mockRequest = { user: { uid: 'user-123' } };
      const complaintId = 'complaint-123';
      const resolveDto = { status: ComplaintStatus.RESOLVED };

      mockComplaintsService.resolveComplaint.mockRejectedValue(
        new ForbiddenException('Only admins can resolve complaints'),
      );

      await expect(
        controller.resolveComplaint(mockRequest, complaintId, resolveDto),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
