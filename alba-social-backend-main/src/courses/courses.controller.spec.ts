import { Test, TestingModule } from '@nestjs/testing';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { PrismaService } from '../prisma/prisma.service';
import { MapboxService } from '../shared/services/mapbox.service';
import { GoogleMapsService } from '../shared/services/google-maps.service';
import { FindCoursesByLocationDto } from './dto/find-courses-by-location.dto';
import { GolfCourse } from '@prisma/client';
import { FirebaseService } from '../firebase/firebase.service';
import { FirebaseAuthGuard } from '../guards/firebase-auth.guard';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

describe('CoursesController', () => {
  let controller: CoursesController;
  let coursesService: CoursesService;

  // Define the augmented type for mock data
  type AugmentedGolfCourse = GolfCourse & {
    distance: number;
    price_rating?: number;
    num_holes?: number;
    course_par?: number;
    course_slope?: number | null;
  };

  const mockAugmentedCourses: AugmentedGolfCourse[] = [
    {
      id: '1',
      name: 'Course A',
      lat: 51.5,
      lng: -0.1,
      address: '123 Golf Rd, London',
      saturday_9am_cost_pence: 5000,
      is_bookable: false,
      closed_down: false,
      booking_url: null,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
      distance: 5.0,
      price_rating: 3,
      num_holes: 18,
      course_par: 72,
      course_slope: 128,
    },
    {
      id: '2',
      name: 'Course B',
      lat: 51.52,
      lng: -0.12,
      address: '456 Links Ave, London',
      saturday_9am_cost_pence: 7500,
      is_bookable: true,
      closed_down: false,
      booking_url: 'http://courseb.example.com/book',
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
      distance: 2.1,
      // price_rating is optional
      num_holes: 18,
      course_par: 70,
      course_slope: null, // Slope can be null
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CoursesController],
      providers: [
        CoursesService,
        {
          provide: PrismaService,
          useValue: {
            golfCourse: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: MapboxService,
          useValue: {
            searchLocations: jest.fn(),
          },
        },
        {
          provide: GoogleMapsService,
          useValue: {
            searchLocations: jest.fn(),
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
          },
        },
        {
          provide: FirebaseService,
          useValue: {
            getAuth: jest.fn().mockReturnValue({
              verifyIdToken: jest.fn(),
            }),
          },
        },
        {
          provide: FirebaseAuthGuard,
          useValue: {
            canActivate: jest.fn().mockReturnValue(true),
          },
        },
      ],
    }).compile();

    controller = module.get<CoursesController>(CoursesController);
    coursesService = module.get<CoursesService>(CoursesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getCoursesByLocation', () => {
    it('should return courses by location', async () => {
      // Arrange
      const locationDto: FindCoursesByLocationDto = {
        lat: 51.5,
        lng: -0.1,
        radius: 10,
      };

      jest
        .spyOn(coursesService, 'findCoursesByLocation')
        .mockResolvedValue(mockAugmentedCourses);

      // Act
      const result = await controller.getCoursesByLocation(locationDto);

      // Assert
      expect(result).toEqual(mockAugmentedCourses);
      expect(coursesService.findCoursesByLocation).toHaveBeenCalledWith(
        locationDto,
      );
    });

    it('should pass parameters correctly to service', async () => {
      // Arrange
      const locationDto: FindCoursesByLocationDto = {
        lat: 52.0,
        lng: -1.0,
        radius: 20,
      };
      // For this test, an empty array is fine as long as its type is compatible.
      const emptyMockResult: AugmentedGolfCourse[] = [];
      jest
        .spyOn(coursesService, 'findCoursesByLocation')
        .mockResolvedValue(emptyMockResult);

      // Act
      await controller.getCoursesByLocation(locationDto);

      // Assert
      expect(coursesService.findCoursesByLocation).toHaveBeenCalledWith(
        expect.objectContaining({
          lat: 52.0,
          lng: -1.0,
          radius: 20,
        }),
      );
    });

    it('should handle empty results', async () => {
      // Arrange
      const locationDto: FindCoursesByLocationDto = {
        lat: 90.0,
        lng: 180.0,
        radius: 5,
      };
      const emptyMockResult: AugmentedGolfCourse[] = [];
      jest
        .spyOn(coursesService, 'findCoursesByLocation')
        .mockResolvedValue(emptyMockResult);

      // Act
      const result = await controller.getCoursesByLocation(locationDto);

      // Assert
      expect(result).toEqual([]);
    });
  });
});
