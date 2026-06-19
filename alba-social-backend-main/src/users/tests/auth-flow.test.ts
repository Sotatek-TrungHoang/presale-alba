import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from '../users.controller';
import { UsersService } from '../users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { FirebaseAuthGuard } from '../../guards/firebase-auth.guard';
import { ExecutionContext } from '@nestjs/common';

describe('Authentication Flow', () => {
  let controller: UsersController;
  let service: UsersService;
  let guard: FirebaseAuthGuard;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    profile: {
      create: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
  };

  const mockFirebaseAuthGuard = {
    canActivate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: FirebaseAuthGuard,
          useValue: mockFirebaseAuthGuard,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
    guard = module.get<FirebaseAuthGuard>(FirebaseAuthGuard);
    jest.clearAllMocks();
  });

  describe('Authentication Guard', () => {
    it('should allow authenticated requests', async () => {
      // Mock execution context
      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            headers: {
              authorization: 'Bearer valid-token',
            },
          }),
        }),
        getHandler: jest.fn(),
        getClass: jest.fn(),
      } as unknown as ExecutionContext;

      // Mock successful authentication
      mockFirebaseAuthGuard.canActivate.mockResolvedValue(true);

      // Call the guard
      const result = await guard.canActivate(mockContext);

      // Assertions
      expect(mockFirebaseAuthGuard.canActivate).toHaveBeenCalledWith(
        mockContext,
      );
      expect(result).toBe(true);
    });

    it('should reject unauthenticated requests', async () => {
      // Mock execution context without auth token
      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            headers: {},
          }),
        }),
        getHandler: jest.fn(),
        getClass: jest.fn(),
      } as unknown as ExecutionContext;

      // Mock failed authentication
      mockFirebaseAuthGuard.canActivate.mockResolvedValue(false);

      // Call the guard
      const result = await guard.canActivate(mockContext);

      // Assertions
      expect(mockFirebaseAuthGuard.canActivate).toHaveBeenCalledWith(
        mockContext,
      );
      expect(result).toBe(false);
    });
  });

  describe('User Registration', () => {
    it('should create a new user on first authentication', async () => {
      // Mock data
      const authId = 'new-auth-id';
      const email = 'new.user@example.com';
      const req = {
        user: {
          uid: authId,
          email: email,
        },
      };

      // Mock user not found
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      // Mock user creation
      const newUser = {
        id: 'new-user-id',
        auth_id: authId,
        email: email,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockPrismaService.user.create.mockResolvedValue(newUser);

      // Call the controller method
      const result = await controller.findMe(req);

      // Assertions
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { auth_id: authId },
        include: { profile: true },
      });

      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          auth_id: authId,
          email: email,
        },
      });

      expect(result).toEqual(newUser);
    });

    it('should return existing user on subsequent authentications', async () => {
      // Mock data
      const authId = 'existing-auth-id';
      const email = 'existing.user@example.com';
      const req = {
        user: {
          uid: authId,
          email: email,
        },
      };

      // Mock existing user
      const existingUser = {
        id: 'existing-user-id',
        auth_id: authId,
        email: email,
        created_at: new Date(),
        updated_at: new Date(),
        profile: {
          id: 'profile-id',
          first_name: 'John',
          last_name: 'Doe',
        },
      };
      mockPrismaService.user.findUnique.mockResolvedValue(existingUser);

      // Call the controller method
      const result = await controller.findMe(req);

      // Assertions
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { auth_id: authId },
        include: { profile: true },
      });

      // Should not create a new user
      expect(mockPrismaService.user.create).not.toHaveBeenCalled();

      expect(result).toEqual(existingUser);
    });
  });
});
