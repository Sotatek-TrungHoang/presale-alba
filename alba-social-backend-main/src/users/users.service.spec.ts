import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { CoursesService } from '../courses/courses.service';
import { FirebaseService } from '../firebase/firebase.service';
import { CreateUserWithOnboardingDto } from './dto/create-user-with-onboarding.dto';
import { GameType, HandicapRange, PlayerType, TimeSlot } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';

// Mock the PrismaService
const mockPrismaService = {
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  profile: {
    create: jest.fn(),
  },
  userOnboarding: {
    create: jest.fn(),
    findUnique: jest.fn(),
  },
  userAvailability: {
    create: jest.fn(),
  },
  userTimeSlot: {
    createMany: jest.fn(),
  },
  favouriteCourse: {
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn((callback) => callback(mockPrismaService)),
};

const mockCoursesService = {
  findOne: jest.fn(),
};

const mockFirebaseService = {
  getAuth: jest.fn(),
  deleteUser: jest.fn(),
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: CoursesService,
          useValue: mockCoursesService,
        },
        {
          provide: FirebaseService,
          useValue: mockFirebaseService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all users without pagination', async () => {
      // Arrange
      const mockUsers = [
        {
          id: 'user-1',
          auth_id: 'auth-1',
          email: 'user1@example.com',
          profile: { first_name: 'User', last_name: 'One' },
          onboarding: null,
        },
        {
          id: 'user-2',
          auth_id: 'auth-2',
          email: 'user2@example.com',
          profile: { first_name: 'User', last_name: 'Two' },
          onboarding: null,
        },
      ];

      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);

      // Act
      const result = await service.findAll();

      // Assert
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        where: { deleted_at: null },
        include: {
          profile: true,
          onboarding: {
            include: {
              availability: {
                include: {
                  time_slots: true,
                },
              },
            },
          },
        },
      });
      expect(result).toEqual(mockUsers);
    });
  });

  describe('findAllPaginated', () => {
    it('should return paginated users with default pagination', async () => {
      // Arrange
      const mockUsers = [
        {
          id: 'user-1',
          auth_id: 'auth-1',
          email: 'user1@example.com',
          profile: { first_name: 'User', last_name: 'One' },
          onboarding: null,
        },
        {
          id: 'user-2',
          auth_id: 'auth-2',
          email: 'user2@example.com',
          profile: { first_name: 'User', last_name: 'Two' },
          onboarding: null,
        },
      ];
      const totalCount = 25;

      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);
      mockPrismaService.user.count.mockResolvedValue(totalCount);

      // Act
      const result = await service.findAllPaginated();

      // Assert
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        where: { deleted_at: null },
        include: {
          profile: true,
          latestLocation: true,
        },
        skip: 0,
        take: 10,
        orderBy: { created_at: 'desc' },
      });
      expect(mockPrismaService.user.count).toHaveBeenCalledWith({
        where: { deleted_at: null },
      });
      expect(result).toEqual({
        data: mockUsers,
        pagination: {
          page: 1,
          limit: 10,
          total: totalCount,
          totalPages: 3,
        },
      });
    });

    it('should return paginated users with custom page and limit', async () => {
      // Arrange
      const mockUsers = [
        {
          id: 'user-11',
          auth_id: 'auth-11',
          email: 'user11@example.com',
          profile: { first_name: 'User', last_name: 'Eleven' },
          onboarding: null,
        },
      ];
      const totalCount = 50;
      const page = 2;
      const limit = 20;

      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);
      mockPrismaService.user.count.mockResolvedValue(totalCount);

      // Act
      const result = await service.findAllPaginated({ page, limit });

      // Assert
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        where: { deleted_at: null },
        include: {
          profile: true,
          latestLocation: true,
        },
        skip: 20, // (page - 1) * limit = (2 - 1) * 20
        take: 20,
        orderBy: { created_at: 'desc' },
      });
      expect(result).toEqual({
        data: mockUsers,
        pagination: {
          page: 2,
          limit: 20,
          total: 50,
          totalPages: 3, // Math.ceil(50 / 20)
        },
      });
    });

    it('should return empty array when no users exist', async () => {
      // Arrange
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.user.count.mockResolvedValue(0);

      // Act
      const result = await service.findAllPaginated();

      // Assert
      expect(result).toEqual({
        data: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
        },
      });
    });

    it('should handle page 1 with exact multiple of limit', async () => {
      // Arrange
      const mockUsers = Array(10).fill({
        id: 'user-id',
        auth_id: 'auth-id',
        email: 'user@example.com',
        profile: { first_name: 'User', last_name: 'Name' },
        onboarding: null,
      });
      const totalCount = 30;

      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);
      mockPrismaService.user.count.mockResolvedValue(totalCount);

      // Act
      const result = await service.findAllPaginated({ page: 1, limit: 10 });

      // Assert
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 30,
        totalPages: 3,
      });
    });
  });

  describe('createWithOnboarding', () => {
    it('should create a user with onboarding data in a transaction', async () => {
      // Arrange
      const userId = 'test-user-id';
      const onboardingId = 'test-onboarding-id';
      const availabilityId = 'test-availability-id';

      const mockDto: CreateUserWithOnboardingDto = {
        auth_id: 'auth-id-123',
        email: 'test@example.com',
        admin_status: false,
        first_name: 'Test',
        last_name: 'User',
        handicapRange: HandicapRange.MID,
        playerType: PlayerType.CASUAL_PLAYER,
        preferences: [GameType.PURELY_SOCIAL],
        availability: {
          weekdays: [TimeSlot.EARLY_MORNING, TimeSlot.LATE_MORNING],
          weekends: [TimeSlot.LUNCHTIME],
        },
        homeCourses: ['course-1', 'course-2'],
      };

      // Mock return values
      mockPrismaService.user.create.mockResolvedValue({ id: userId });
      mockPrismaService.profile.create.mockResolvedValue({
        id: 'profile-id',
        user_id: userId,
      });
      mockPrismaService.userOnboarding.create.mockResolvedValue({
        id: onboardingId,
        user_id: userId,
      });
      mockPrismaService.userAvailability.create.mockResolvedValue({
        id: availabilityId,
      });
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: userId,
        profile: { name: 'Test User' },
        onboarding: { handicap_range: HandicapRange.MID },
        favourite_courses: [{ course: { id: 'course-1', name: 'Course 1' } }],
      });

      // Act
      const result = await service.createWithOnboarding(mockDto);

      // Assert
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          auth_id: mockDto.auth_id,
          admin_status: mockDto.admin_status,
          email: mockDto.email,
        },
      });
      expect(mockPrismaService.profile.create).toHaveBeenCalledWith({
        data: {
          user_id: userId,
          first_name: mockDto.first_name,
          last_name: mockDto.last_name,
        },
      });
      expect(mockPrismaService.userOnboarding.create).toHaveBeenCalledWith({
        data: {
          user: { connect: { id: userId } },
          handicap_range: mockDto.handicapRange,
          player_type: mockDto.playerType,
          preferences: mockDto.preferences,
          onboarding_completed: true,
        },
      });
      expect(mockPrismaService.userAvailability.create).toHaveBeenCalledWith({
        data: {
          onboarding: { connect: { id: onboardingId } },
        },
      });
      expect(mockPrismaService.userTimeSlot.createMany).toHaveBeenCalled();
      expect(mockPrismaService.favouriteCourse.createMany).toHaveBeenCalled();
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId, deleted_at: null },
        include: {
          profile: true,
          onboarding: {
            include: {
              availability: {
                include: {
                  time_slots: true,
                },
              },
            },
          },
          favourite_courses: {
            include: {
              course: true,
            },
          },
        },
      });
      expect(result).toBeDefined();
    });

    it('should create a user without availability if not provided', async () => {
      // Arrange
      const userId = 'test-user-id';
      const onboardingId = 'test-onboarding-id';

      const mockDto: CreateUserWithOnboardingDto = {
        auth_id: 'auth-id-123',
        email: 'test@example.com',
        admin_status: false,
        first_name: 'Test',
        last_name: 'User',
        handicapRange: HandicapRange.MID,
        playerType: PlayerType.CASUAL_PLAYER,
        preferences: [GameType.PURELY_SOCIAL],
        homeCourses: ['course-1'],
      };

      // Mock return values
      mockPrismaService.user.create.mockResolvedValue({ id: userId });
      mockPrismaService.profile.create.mockResolvedValue({
        id: 'profile-id',
        user_id: userId,
      });
      mockPrismaService.userOnboarding.create.mockResolvedValue({
        id: onboardingId,
        user_id: userId,
      });
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: userId,
        profile: { name: 'Test User' },
        onboarding: { handicap_range: HandicapRange.MID },
        favourite_courses: [{ course: { id: 'course-1', name: 'Course 1' } }],
      });

      // Act
      await service.createWithOnboarding(mockDto);

      // Assert
      expect(mockPrismaService.userAvailability.create).not.toHaveBeenCalled();
      expect(mockPrismaService.userTimeSlot.createMany).not.toHaveBeenCalled();
    });

    it('should create a user without home courses if not provided', async () => {
      // Arrange
      const userId = 'test-user-id';
      const onboardingId = 'test-onboarding-id';

      const mockDto: CreateUserWithOnboardingDto = {
        auth_id: 'auth-id-123',
        email: 'test@example.com',
        admin_status: false,
        first_name: 'Test',
        last_name: 'User',
        handicapRange: HandicapRange.MID,
        playerType: PlayerType.CASUAL_PLAYER,
        preferences: [GameType.PURELY_SOCIAL],
      };

      // Mock return values
      mockPrismaService.user.create.mockResolvedValue({ id: userId });
      mockPrismaService.profile.create.mockResolvedValue({
        id: 'profile-id',
        user_id: userId,
      });
      mockPrismaService.userOnboarding.create.mockResolvedValue({
        id: onboardingId,
        user_id: userId,
      });
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: userId,
        profile: { name: 'Test User' },
        onboarding: { handicap_range: HandicapRange.MID },
        favourite_courses: [],
      });

      // Act
      await service.createWithOnboarding(mockDto);

      // Assert
      expect(
        mockPrismaService.favouriteCourse.createMany,
      ).not.toHaveBeenCalled();
    });
  });

  describe('getOnboardingData', () => {
    it('should return onboarding data for a user', async () => {
      // Arrange
      const authId = 'auth-id-123';
      const userId = 'user-id-123';
      const onboardingData = {
        id: 'onboarding-id',
        user_id: userId,
        handicap_range: HandicapRange.MID,
        player_type: PlayerType.CASUAL_PLAYER,
        preferences: [GameType.PURELY_SOCIAL],
        availability: {
          weekday_slots: [{ time_slot: TimeSlot.EARLY_MORNING }],
          weekend_slots: [{ time_slot: TimeSlot.LUNCHTIME }],
        },
      };

      mockPrismaService.user.findUnique.mockResolvedValue({ id: userId });
      mockPrismaService.userOnboarding.findUnique.mockResolvedValue(
        onboardingData,
      );

      // Act
      const result = await service.getOnboardingData(authId);

      // Assert
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { auth_id: authId },
      });
      expect(mockPrismaService.userOnboarding.findUnique).toHaveBeenCalledWith({
        where: { user_id: userId },
        include: expect.any(Object),
      });
      expect(result).toEqual(onboardingData);
    });

    it('should throw NotFoundException if user not found', async () => {
      // Arrange
      const authId = 'auth-id-123';
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getOnboardingData(authId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
