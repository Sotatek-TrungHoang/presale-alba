import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { FirebaseAuthGuard } from '../guards/firebase-auth.guard';
import { FirebaseService } from '../firebase/firebase.service';
import { CreateUserWithOnboardingDto } from './dto/create-user-with-onboarding.dto';
import { GameType, HandicapRange, PlayerType, TimeSlot } from '@prisma/client';
import { UserOnboardingDto } from './dto/user-onboarding.dto';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: UsersService;

  const mockUsersService = {
    findAll: jest.fn(),
    findOneByAuthId: jest.fn(),
    createWithOnboarding: jest.fn(),
    saveOnboardingData: jest.fn(),
    getOnboardingData: jest.fn(),
  };

  // Mock request object for authenticated routes
  const mockRequest = {
    user: { uid: 'test-auth-id' },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
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

    controller = module.get<UsersController>(UsersController);
    usersService = module.get<UsersService>(UsersService);

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all users without pagination', async () => {
      // Arrange
      const expectedResult = [
        {
          id: 'user-1',
          auth_id: 'auth-1',
          email: 'user1@example.com',
          profile: { first_name: 'User', last_name: 'One' },
        },
        {
          id: 'user-2',
          auth_id: 'auth-2',
          email: 'user2@example.com',
          profile: { first_name: 'User', last_name: 'Two' },
        },
      ];

      mockUsersService.findAll.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.findAll();

      // Assert
      expect(mockUsersService.findAll).toHaveBeenCalled();
      expect(result).toEqual(expectedResult);
    });
  });

  describe('createWithOnboarding', () => {
    it('should create a user with onboarding data', async () => {
      // Arrange
      const createUserDto: CreateUserWithOnboardingDto = {
        auth_id: 'test-auth-id',
        email: 'test@example.com',
        admin_status: false,
        first_name: 'Test',
        last_name: 'User',
        handicapRange: HandicapRange.MID,
        playerType: PlayerType.CASUAL_PLAYER,
        preferences: [GameType.PURELY_SOCIAL],
        availability: {
          weekdays: [TimeSlot.EARLY_MORNING],
          weekends: [TimeSlot.LUNCHTIME],
        },
        homeCourses: [],
      };

      const expectedResult = {
        id: 'user-id',
        profile: { first_name: 'Test', last_name: 'User' },
        onboarding: {
          handicap_range: HandicapRange.MID,
          onboarding_completed: true,
        },
      };

      mockUsersService.createWithOnboarding.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.createWithOnboarding(createUserDto);

      // Assert
      expect(mockUsersService.createWithOnboarding).toHaveBeenCalledWith(
        createUserDto,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('saveOnboarding', () => {
    it('should save onboarding data for an existing user', async () => {
      // Arrange
      const onboardingData: UserOnboardingDto = {
        handicapRange: HandicapRange.MID,
        playerType: PlayerType.CASUAL_PLAYER,
        preferences: [GameType.PURELY_SOCIAL],
        homeCourses: [],
        availability: {
          weekdays: [TimeSlot.EARLY_MORNING],
          weekends: [TimeSlot.LUNCHTIME],
        },
      };

      const expectedResult = {
        id: 'onboarding-id',
        user_id: 'user-id',
        handicap_range: HandicapRange.MID,
        player_type: PlayerType.CASUAL_PLAYER,
        preferences: [GameType.PURELY_SOCIAL],
        onboarding_completed: true,
      };

      mockUsersService.saveOnboardingData.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.saveOnboarding(
        mockRequest,
        onboardingData,
      );

      // Assert
      expect(mockUsersService.saveOnboardingData).toHaveBeenCalledWith(
        'test-auth-id',
        onboardingData,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getOnboarding', () => {
    it('should retrieve onboarding data for a user', async () => {
      // Arrange
      const expectedResult = {
        id: 'onboarding-id',
        user_id: 'user-id',
        handicap_range: HandicapRange.MID,
        player_type: PlayerType.CASUAL_PLAYER,
        preferences: [GameType.PURELY_SOCIAL],
        onboarding_completed: true,
      };

      mockUsersService.getOnboardingData.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.getOnboarding(mockRequest);

      // Assert
      expect(mockUsersService.getOnboardingData).toHaveBeenCalledWith(
        'test-auth-id',
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('findMe', () => {
    it('should retrieve the current user profile', async () => {
      // Arrange
      const expectedResult = {
        id: 'user-id',
        auth_id: 'test-auth-id',
        email: 'test@example.com',
        profile: { name: 'Test User' },
      };

      mockUsersService.findOneByAuthId.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.findMe(mockRequest);

      // Assert
      expect(mockUsersService.findOneByAuthId).toHaveBeenCalledWith(
        'test-auth-id',
      );
      expect(result).toEqual(expectedResult);
    });
  });
});
