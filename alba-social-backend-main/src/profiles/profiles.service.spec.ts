import { Test, TestingModule } from '@nestjs/testing';
import { ProfilesService } from './profiles.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { UserProfileDto } from './dto/user-profile.dto';
import { GameType, HandicapRange, PlayerType, TimeSlot } from '@prisma/client';
import { CreateProfileDto } from './dto/create-profile.dto';

// Mock PrismaService
const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
  },
  profile: {
    upsert: jest.fn(),
    update: jest.fn(),
  },
  userOnboarding: {
    upsert: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  userAvailability: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  userTimeSlot: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  favouriteCourse: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  $transaction: jest.fn((callback) => callback(mockPrismaService)),
};

describe('ProfilesService', () => {
  let service: ProfilesService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfilesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ProfilesService>(ProfilesService);
    prismaService = module.get<PrismaService>(PrismaService);

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserProfile', () => {
    it('should return a user profile when auth_id is valid', async () => {
      // Arrange
      const authId = 'auth-123';
      const mockUser = {
        id: 'user-123',
        auth_id: authId,
        profile: {
          first_name: 'Test',
          last_name: 'User',
          handicap: 15,
        },
        onboarding: {
          handicap_range: HandicapRange.MID,
          player_type: PlayerType.CASUAL_PLAYER,
          preferences: [GameType.PURELY_SOCIAL],
          availability: {
            time_slots: [
              { time_slot: TimeSlot.EARLY_MORNING, day_type: 'WEEKDAY' },
              { time_slot: TimeSlot.LUNCHTIME, day_type: 'WEEKEND' },
            ],
          },
        },
        favourite_courses: [
          { course: { id: 'course-1', name: 'Golf Course 1' } },
        ],
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      // Act
      const result = await service.getUserProfile(authId);

      // Assert
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { auth_id: authId },
        include: expect.any(Object),
      });
      expect(result).toMatchObject({
        id: mockUser.id,
        first_name: mockUser.profile.first_name,
        last_name: mockUser.profile.last_name,
        handicap: mockUser.profile.handicap,
        handicapRange: mockUser.onboarding.handicap_range,
        playerType: mockUser.onboarding.player_type,
        preferences: mockUser.onboarding.preferences,
      });
    });

    it('should throw NotFoundException when user is not found', async () => {
      // Arrange
      const authId = 'non-existent-auth-id';
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getUserProfile(authId)).rejects.toThrow(
        NotFoundException,
      );

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { auth_id: authId },
        include: expect.any(Object),
      });
    });
  });

  describe('updateUserProfile', () => {
    it('should update user profile with all fields', async () => {
      // Arrange
      const authId = 'auth-123';
      const userId = 'user-123';
      const mockUser = {
        id: userId,
        auth_id: authId,
        profile: {
          name: 'Old Name',
          handicap: 10,
        },
        onboarding: {
          id: 'onboarding-id',
          handicap_range: HandicapRange.LOW,
          player_type: PlayerType.CASUAL_PLAYER,
          preferences: [GameType.PURELY_SOCIAL],
        },
      };

      const updatedUser = {
        id: userId,
        auth_id: authId,
        profile: {
          name: 'New Name',
          handicap: 15,
        },
        onboarding: {
          id: 'onboarding-id',
          handicap_range: HandicapRange.MID,
          player_type: PlayerType.DEDICATED_IMPROVER,
          preferences: [GameType.RELAXED_ROUND],
          availability: {
            time_slots: [
              { time_slot: TimeSlot.EARLY_MORNING, day_type: 'WEEKDAY' },
              { time_slot: TimeSlot.LUNCHTIME, day_type: 'WEEKEND' },
            ],
          },
        },
        favourite_courses: [
          { course: { id: 'course-1', name: 'Golf Course 1' } },
        ],
      };

      const profileDto: UserProfileDto = {
        first_name: 'New',
        last_name: 'Name',
        handicap: 15,
        address_line_1: '123 Golf Lane',
        address_line_2: 'Fairway Estate',
        postcode: 'SW1A 1AA',
        city: 'London',
        mobile_number: '+447700900000',
        handicapRange: HandicapRange.MID,
        playerType: PlayerType.DEDICATED_IMPROVER,
        preferences: [GameType.RELAXED_ROUND],
        availability: {
          weekdays: [TimeSlot.EARLY_MORNING],
          weekends: [TimeSlot.LUNCHTIME],
        },
        homeCourses: ['course-1'],
      };

      mockPrismaService.user.findUnique.mockResolvedValueOnce(mockUser);
      mockPrismaService.user.findUnique.mockResolvedValueOnce(updatedUser);
      mockPrismaService.profile.update.mockResolvedValue({});
      mockPrismaService.userOnboarding.update.mockResolvedValue({});
      mockPrismaService.userAvailability.findUnique.mockResolvedValue({
        id: 'availability-id',
        time_slots: [
          { time_slot: TimeSlot.EARLY_MORNING, day_type: 'WEEKDAY' },
          { time_slot: TimeSlot.LUNCHTIME, day_type: 'WEEKEND' },
        ],
      });

      // Act
      const result = await service.updateUserProfile(authId, profileDto);

      // Assert
      expect(mockPrismaService.user.findUnique).toHaveBeenNthCalledWith(1, {
        where: { auth_id: authId },
        include: expect.any(Object),
      });
      expect(mockPrismaService.profile.update).toHaveBeenCalledWith({
        where: { user_id: userId },
        data: expect.objectContaining({
          first_name: profileDto.first_name,
          last_name: profileDto.last_name,
          handicap: profileDto.handicap,
          address_line_1: profileDto.address_line_1,
          address_line_2: profileDto.address_line_2,
          postcode: profileDto.postcode,
          city: profileDto.city,
          mobile_number: profileDto.mobile_number,
        }),
      });
      expect(mockPrismaService.userOnboarding.update).toHaveBeenCalledWith({
        where: { id: mockUser.onboarding.id },
        data: expect.objectContaining({
          handicap_range: profileDto.handicapRange,
          player_type: profileDto.playerType,
          preferences: profileDto.preferences,
        }),
      });

      // Conditional assertions - these calls only happen under certain conditions
      if (profileDto.availability) {
        expect(mockPrismaService.userTimeSlot.deleteMany).toHaveBeenCalled();
        expect(mockPrismaService.userTimeSlot.createMany).toHaveBeenCalled();
      }

      if (profileDto.homeCourses && profileDto.homeCourses.length > 0) {
        expect(mockPrismaService.favouriteCourse.deleteMany).toHaveBeenCalled();
        expect(mockPrismaService.favouriteCourse.createMany).toHaveBeenCalled();
      }

      expect(result).toBeDefined();
    });

    it('should create onboarding if it does not exist', async () => {
      // Arrange
      const authId = 'auth-123';
      const userId = 'user-123';
      const mockUser = {
        id: userId,
        auth_id: authId,
        profile: {
          name: 'Old Name',
          handicap: 10,
        },
        onboarding: null,
      };

      const updatedUser = {
        id: userId,
        auth_id: authId,
        profile: {
          name: 'New Name',
          handicap: 15,
        },
        onboarding: {
          id: 'new-onboarding-id',
          handicap_range: HandicapRange.MID,
          player_type: PlayerType.DEDICATED_IMPROVER,
          preferences: [GameType.RELAXED_ROUND],
        },
        favourite_courses: [],
      };

      const profileDto: UserProfileDto = {
        first_name: 'New',
        last_name: 'Name',
        handicap: 15,
        handicapRange: HandicapRange.MID,
        playerType: PlayerType.DEDICATED_IMPROVER,
        preferences: [GameType.RELAXED_ROUND],
      };

      mockPrismaService.user.findUnique.mockResolvedValueOnce(mockUser);
      mockPrismaService.user.findUnique.mockResolvedValueOnce(updatedUser);
      mockPrismaService.profile.update.mockResolvedValue({});
      mockPrismaService.userOnboarding.create.mockResolvedValue({
        id: 'new-onboarding-id',
      });

      // Act
      const result = await service.updateUserProfile(authId, profileDto);

      // Assert
      expect(mockPrismaService.userOnboarding.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          user: { connect: { id: userId } },
          handicap_range: profileDto.handicapRange,
          player_type: profileDto.playerType,
          preferences: profileDto.preferences,
        }),
      });
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException when user is not found', async () => {
      // Arrange
      const authId = 'non-existent-auth-id';
      const profileDto: UserProfileDto = {
        first_name: 'New',
        last_name: 'Name',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.updateUserProfile(authId, profileDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a complete profile with all related data', async () => {
      // Arrange
      const userId = 'user-123';
      const profileDto: CreateProfileDto = {
        user_id: userId,
        first_name: 'New',
        last_name: 'User',
        handicap: 15,
        handicapRange: HandicapRange.MID,
        playerType: PlayerType.CASUAL_PLAYER,
        preferences: [GameType.PURELY_SOCIAL],
        availability: {
          weekdays: [TimeSlot.EARLY_MORNING],
          weekends: [TimeSlot.LUNCHTIME],
        },
        homeCourses: ['course-1'],
      };

      mockPrismaService.user.findUnique.mockResolvedValue({ id: userId });

      const mockCompleteUser = {
        id: userId,
        profile: {
          name: 'New User',
          handicap: 15,
        },
        onboarding: {
          handicap_range: HandicapRange.MID,
          player_type: PlayerType.CASUAL_PLAYER,
          preferences: [GameType.PURELY_SOCIAL],
          availability: {
            time_slots: [
              { time_slot: TimeSlot.EARLY_MORNING, day_type: 'WEEKDAY' },
              { time_slot: TimeSlot.LUNCHTIME, day_type: 'WEEKEND' },
            ],
          },
        },
        favourite_courses: [
          { course: { id: 'course-1', name: 'Golf Course 1' } },
        ],
      };

      mockPrismaService.user.findUnique.mockResolvedValueOnce({ id: userId });
      mockPrismaService.user.findUnique.mockResolvedValueOnce(mockCompleteUser);
      mockPrismaService.profile.upsert.mockResolvedValue({});
      mockPrismaService.userOnboarding.upsert.mockResolvedValue({
        id: 'onboarding-id',
      });
      mockPrismaService.userAvailability.upsert.mockResolvedValue({
        id: 'availability-id',
      });

      // Act
      const result = await service.create(profileDto);

      // Assert
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(mockPrismaService.profile.upsert).toHaveBeenCalled();
      expect(mockPrismaService.userOnboarding.upsert).toHaveBeenCalled();
      expect(mockPrismaService.userAvailability.upsert).toHaveBeenCalled();
      expect(mockPrismaService.userTimeSlot.deleteMany).toHaveBeenCalled();
      expect(mockPrismaService.userTimeSlot.createMany).toHaveBeenCalled();
      expect(mockPrismaService.favouriteCourse.deleteMany).toHaveBeenCalled();
      expect(mockPrismaService.favouriteCourse.createMany).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException when user is not found', async () => {
      // Arrange
      const profileDto: CreateProfileDto = {
        user_id: 'non-existent-user-id',
        first_name: 'New',
        last_name: 'User',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.create(profileDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
