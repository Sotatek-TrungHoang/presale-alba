import { Test, TestingModule } from '@nestjs/testing';
import { AdminGuard } from './admin.guard';
import { PrismaService } from 'src/prisma/prisma.service';
import { ForbiddenException } from '@nestjs/common';

describe('AdminGuard', () => {
  let guard: AdminGuard;
  let prismaService: PrismaService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
    },
  };

  const mockExecutionContext = {
    switchToHttp: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminGuard,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    guard = module.get<AdminGuard>(AdminGuard);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should allow access for admin users', async () => {
      // Arrange
      const mockRequest: any = {
        user: { uid: 'admin-uid' },
      };
      mockExecutionContext.switchToHttp.mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      });

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'admin-user-id',
        admin_status: true,
      });

      // Act
      const result = await guard.canActivate(mockExecutionContext as any);

      // Assert
      expect(result).toBe(true);
      expect(mockRequest.user.isAdmin).toBe(true);
      expect(mockRequest.user.userId).toBe('admin-user-id');
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { auth_id: 'admin-uid' },
        select: { admin_status: true, id: true },
      });
    });

    it('should deny access for non-admin users', async () => {
      // Arrange
      const mockRequest = {
        user: { uid: 'user-uid' },
      };
      mockExecutionContext.switchToHttp.mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      });

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'regular-user-id',
        admin_status: false,
      });

      // Act & Assert
      await expect(
        guard.canActivate(mockExecutionContext as any),
      ).rejects.toThrow(
        new ForbiddenException('Only administrators can access this resource'),
      );
    });

    it('should throw ForbiddenException if user not found', async () => {
      // Arrange
      const mockRequest = {
        user: { uid: 'non-existent-uid' },
      };
      mockExecutionContext.switchToHttp.mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      });

      mockPrismaService.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        guard.canActivate(mockExecutionContext as any),
      ).rejects.toThrow(new ForbiddenException('User not found'));
    });

    it('should throw ForbiddenException if user not authenticated', async () => {
      // Arrange
      const mockRequest = {
        user: null,
      };
      mockExecutionContext.switchToHttp.mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      });

      // Act & Assert
      await expect(
        guard.canActivate(mockExecutionContext as any),
      ).rejects.toThrow(new ForbiddenException('User not authenticated'));
    });
  });
});
