import { Test, TestingModule } from '@nestjs/testing';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';
import { FirebaseAuthGuard } from '../guards/firebase-auth.guard';
import { FirebaseService } from '../firebase/firebase.service';
import { UserProfileDto } from './dto/user-profile.dto';
import { HandicapRange, PlayerType, GameType, TimeSlot } from '@prisma/client';
import { CreateProfileDto } from './dto/create-profile.dto';

describe('ProfilesController', () => {
  let controller: ProfilesController;

  // Mock the ProfilesService
  const mockProfilesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    getUserProfile: jest.fn(),
    updateUserProfile: jest.fn(),
    remove: jest.fn(),
  };

  // Mock request object for authenticated routes
  const mockRequest = {
    user: { uid: 'test-auth-id' },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfilesController],
      providers: [
        {
          provide: ProfilesService,
          useValue: mockProfilesService,
        },
        {
          provide: FirebaseService,
          useValue: {
            verifyIdToken: jest.fn().mockResolvedValue({ uid: 'test-auth-id' }),
          },
        },
      ],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue({
        canActivate: jest.fn().mockImplementation(() => true),
      })
      .compile();

    controller = module.get<ProfilesController>(ProfilesController);

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getUserProfile', () => {
    it('should return the user profile', async () => {
      // Arrange
      const expectedResult = {
        id: 'user-123',
        first_name: 'Test',
        last_name: 'User',
        handicap: 15,
        handicapRange: HandicapRange.MID,
        playerType: PlayerType.CASUAL_PLAYER,
        preferences: [GameType.PURELY_SOCIAL],
        onboardingCompleted: true,
      };

      mockProfilesService.getUserProfile.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.getUserProfile(mockRequest);

      // Assert
      expect(mockProfilesService.getUserProfile).toHaveBeenCalledWith(
        'test-auth-id',
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getOnboardingStatus', () => {
    it('should return onboarding completion status', async () => {
      // Arrange
      const profileResult = {
        id: 'user-123',
        onboardingCompleted: true,
      };

      mockProfilesService.getUserProfile.mockResolvedValue(profileResult);

      // Act
      const result = await controller.getOnboardingStatus(mockRequest);

      // Assert
      expect(mockProfilesService.getUserProfile).toHaveBeenCalledWith(
        'test-auth-id',
      );
      expect(result).toEqual({ onboardingCompleted: true });
    });
  });

  describe('updateUserProfile', () => {
    it('should update the user profile', async () => {
      // Arrange
      const profileDto: UserProfileDto = {
        first_name: 'Updated',
        last_name: 'User',
        handicap: 18,
        handicapRange: HandicapRange.MID,
        playerType: PlayerType.DEDICATED_IMPROVER,
        preferences: [GameType.COMPETITIVE_MATCH],
        availability: {
          weekdays: [TimeSlot.EARLY_MORNING],
          weekends: [TimeSlot.LUNCHTIME],
        },
      };

      const expectedResult = {
        id: 'user-123',
        first_name: 'Updated',
        last_name: 'User',
        handicap: 18,
        handicapRange: HandicapRange.MID,
        playerType: PlayerType.DEDICATED_IMPROVER,
        preferences: [GameType.COMPETITIVE_MATCH],
        onboardingCompleted: true,
      };

      mockProfilesService.updateUserProfile.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.updateUserProfile(
        mockRequest,
        profileDto,
      );

      // Assert
      expect(mockProfilesService.updateUserProfile).toHaveBeenCalledWith(
        'test-auth-id',
        profileDto,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('create', () => {
    it('should create a new profile', async () => {
      // Arrange
      const createProfileDto: CreateProfileDto = {
        user_id: 'user-123',
        first_name: 'New',
        last_name: 'User',
        handicap: 15,
        handicapRange: HandicapRange.MID,
        playerType: PlayerType.CASUAL_PLAYER,
        preferences: [GameType.PURELY_SOCIAL],
      };

      const expectedResult = {
        id: 'profile-123',
        first_name: 'New',
        last_name: 'User',
        handicap: 15,
        handicapRange: HandicapRange.MID,
        playerType: PlayerType.CASUAL_PLAYER,
        preferences: [GameType.PURELY_SOCIAL],
        onboardingCompleted: true,
      };

      mockProfilesService.create.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.create(createProfileDto);

      // Assert
      expect(mockProfilesService.create).toHaveBeenCalledWith(createProfileDto);
      expect(result).toEqual(expectedResult);
    });
  });
});
