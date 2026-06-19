import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AdminUsersService } from './users.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AdminUsersService', () => {
  let service: AdminUsersService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    user: {
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminUsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AdminUsersService>(AdminUsersService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('updateUser', () => {
    it('should update user admin status', async () => {
      // Arrange
      const userId = 'user-123';
      const updateDto = { admin_status: true };
      const expectedResult = {
        id: userId,
        admin_status: true,
        email: 'test@example.com',
        profile: { first_name: 'Test', last_name: 'User' },
      };
      mockPrismaService.user.update.mockResolvedValue(expectedResult);

      // Act
      const result = await service.updateUser(userId, updateDto);

      // Assert
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId, deleted_at: null },
        data: {
          admin_status: true,
          updated_at: expect.any(Date),
        },
        include: {
          profile: true,
        },
      });
      expect(result).toEqual(expectedResult);
    });

    it('should update user email', async () => {
      // Arrange
      const userId = 'user-123';
      const updateDto = { email: 'newemail@example.com' };
      const expectedResult = {
        id: userId,
        admin_status: false,
        email: 'newemail@example.com',
        profile: { first_name: 'Test', last_name: 'User' },
      };
      mockPrismaService.user.update.mockResolvedValue(expectedResult);

      // Act
      const result = await service.updateUser(userId, updateDto);

      // Assert
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId, deleted_at: null },
        data: {
          email: 'newemail@example.com',
          updated_at: expect.any(Date),
        },
        include: {
          profile: true,
        },
      });
      expect(result).toEqual(expectedResult);
    });

    it('should update user profile fields', async () => {
      // Arrange
      const userId = 'user-123';
      const updateDto = { first_name: 'John', last_name: 'Doe', handicap: 5 };
      const expectedResult = {
        id: userId,
        admin_status: false,
        email: 'test@example.com',
        profile: { first_name: 'John', last_name: 'Doe', handicap: 5 },
      };
      mockPrismaService.user.update.mockResolvedValue(expectedResult);

      // Act
      const result = await service.updateUser(userId, updateDto);

      // Assert
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId, deleted_at: null },
        data: {
          profile: {
            update: {
              first_name: 'John',
              last_name: 'Doe',
              handicap: 5,
            },
          },
          updated_at: expect.any(Date),
        },
        include: {
          profile: true,
        },
      });
      expect(result).toEqual(expectedResult);
    });

    it('should update both user and profile fields together', async () => {
      // Arrange
      const userId = 'user-123';
      const updateDto = {
        admin_status: true,
        email: 'newemail@example.com',
        first_name: 'John',
        last_name: 'Doe',
        address: '123 Main St',
        handicap: 5,
      };
      const expectedResult = {
        id: userId,
        admin_status: true,
        email: 'newemail@example.com',
        profile: {
          first_name: 'John',
          last_name: 'Doe',
          address: '123 Main St',
          handicap: 5,
        },
      };
      mockPrismaService.user.update.mockResolvedValue(expectedResult);

      // Act
      const result = await service.updateUser(userId, updateDto);

      // Assert
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId, deleted_at: null },
        data: {
          admin_status: true,
          email: 'newemail@example.com',
          profile: {
            update: {
              first_name: 'John',
              last_name: 'Doe',
              address: '123 Main St',
              handicap: 5,
            },
          },
          updated_at: expect.any(Date),
        },
        include: {
          profile: true,
        },
      });
      expect(result).toEqual(expectedResult);
    });

    it('should throw NotFoundException when user not found', async () => {
      // Arrange
      const userId = 'non-existent-id';
      const updateDto = { admin_status: true };
      mockPrismaService.user.update.mockRejectedValue({ code: 'P2025' });

      // Act & Assert
      await expect(service.updateUser(userId, updateDto)).rejects.toThrow(
        new NotFoundException(`User with id ${userId} not found`),
      );
    });

    it('should rethrow other errors', async () => {
      // Arrange
      const userId = 'user-123';
      const updateDto = { admin_status: true };
      const error = new Error('Database connection error');
      mockPrismaService.user.update.mockRejectedValue(error);

      // Act & Assert
      await expect(service.updateUser(userId, updateDto)).rejects.toThrow(
        error,
      );
    });

    it('should only update fields that are provided', async () => {
      // Arrange
      const userId = 'user-123';
      const updateDto = { first_name: 'Jane' };
      const expectedResult = {
        id: userId,
        admin_status: false,
        email: 'test@example.com',
        profile: { first_name: 'Jane' },
      };
      mockPrismaService.user.update.mockResolvedValue(expectedResult);

      // Act
      const result = await service.updateUser(userId, updateDto);

      // Assert
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId, deleted_at: null },
        data: {
          profile: {
            update: {
              first_name: 'Jane',
            },
          },
          updated_at: expect.any(Date),
        },
        include: {
          profile: true,
        },
      });
      expect(result).toEqual(expectedResult);
    });
  });
});
