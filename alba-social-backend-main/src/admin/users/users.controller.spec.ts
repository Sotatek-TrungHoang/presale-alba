import { Test, TestingModule } from '@nestjs/testing';
import { AdminUsersController } from './users.controller';
import { UsersService } from '../../users/users.service';
import { AdminUsersService } from './users.service';
import { FirebaseAuthGuard } from '../../guards/firebase-auth.guard';
import { AdminGuard } from '../../guards/admin.guard';
import { FirebaseService } from '../../firebase/firebase.service';

describe('AdminUsersController', () => {
  let controller: AdminUsersController;
  let usersService: UsersService;
  let adminUsersService: AdminUsersService;

  const mockUsersService = {
    findAllPaginated: jest.fn(),
    findOne: jest.fn(),
  };

  const mockAdminUsersService = {
    updateUser: jest.fn(),
  };

  // Mock request object for authenticated routes
  const mockRequest = {
    user: { uid: 'test-admin-auth-id', isAdmin: true },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminUsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: AdminUsersService,
          useValue: mockAdminUsersService,
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

    controller = module.get<AdminUsersController>(AdminUsersController);
    usersService = module.get<UsersService>(UsersService);
    adminUsersService = module.get<AdminUsersService>(AdminUsersService);

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('checkAdmin', () => {
    it('should return isAdmin true for authenticated admin users', () => {
      // Act
      const result = controller.checkAdmin();

      // Assert
      expect(result).toEqual({ isAdmin: true });
    });
  });

  describe('findAllPaginated', () => {
    it('should call usersService.findAllPaginated with provided parameters', async () => {
      // Arrange
      const paginateDto = { page: 2, limit: 20 };
      const expectedResult = {
        users: [],
        pagination: { page: 2, limit: 20, total: 0, totalPages: 0 },
      };
      mockUsersService.findAllPaginated.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.findAllPaginated(paginateDto);

      // Assert
      expect(mockUsersService.findAllPaginated).toHaveBeenCalledWith(
        paginateDto,
      );
      expect(result).toEqual(expectedResult);
    });

    it('should call usersService.findAllPaginated with search parameter', async () => {
      // Arrange
      const paginateDto = { page: 1, limit: 10, search: 'john' };
      const expectedResult = {
        users: [
          {
            id: '1',
            email: 'john@example.com',
            profile: { first_name: 'John', last_name: 'Doe' },
          },
        ],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };
      mockUsersService.findAllPaginated.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.findAllPaginated(paginateDto);

      // Assert
      expect(mockUsersService.findAllPaginated).toHaveBeenCalledWith(
        paginateDto,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('findOne', () => {
    it('should call usersService.findOne with provided user id', async () => {
      // Arrange
      const userId = 'user-123';
      const expectedResult = {
        id: userId,
        email: 'test@example.com',
        profile: { first_name: 'Test', last_name: 'User' },
      };
      mockUsersService.findOne.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.findOne(userId);

      // Assert
      expect(mockUsersService.findOne).toHaveBeenCalledWith(userId);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('updateUser', () => {
    it('should call adminUsersService.updateUser with user id and update data', async () => {
      // Arrange
      const userId = 'user-123';
      const updateDto = {
        admin_status: true,
        first_name: 'John',
        last_name: 'Doe',
      };
      const expectedResult = {
        id: userId,
        admin_status: true,
        email: 'john.doe@example.com',
        profile: { first_name: 'John', last_name: 'Doe' },
      };
      mockAdminUsersService.updateUser.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.updateUser(userId, updateDto);

      // Assert
      expect(mockAdminUsersService.updateUser).toHaveBeenCalledWith(
        userId,
        updateDto,
      );
      expect(result).toEqual(expectedResult);
    });
  });
});
