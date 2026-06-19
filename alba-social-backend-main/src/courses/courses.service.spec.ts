import { Test, TestingModule } from '@nestjs/testing';
import { CoursesService } from './courses.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { MapboxService } from 'src/shared/services/mapbox.service';
import { FindCoursesByLocationDto } from './dto/find-courses-by-location.dto';
import { GolfCourse } from '@prisma/client';
import { GoogleMapsService } from 'src/shared/services/google-maps.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

describe('CoursesService', () => {
  let service: CoursesService;
  let prismaService: PrismaService;

  // Mock golf courses data
  const mockCourses: any[] = [
    {
      id: '1',
      name: 'Course A',
      lat: 51.5,
      lng: -0.1,
      address: 'London',
      deleted_at: null,
    },
    {
      id: '2',
      name: 'Course B',
      lat: 51.52,
      lng: -0.12,
      address: 'London',
      deleted_at: null,
    },
    {
      id: '3',
      name: 'Course C',
      lat: 51.55,
      lng: -0.15,
      address: 'London',
      deleted_at: null,
    },
    {
      id: '4',
      name: 'Course D',
      lat: 52.0,
      lng: -1.0,
      address: 'Far Away',
      deleted_at: null,
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoursesService,
        {
          provide: PrismaService,
          useValue: {
            golfCourse: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              count: jest.fn(),
            },
            coursePriceThreshold: {
              findMany: jest.fn(),
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
      ],
    }).compile();

    service = module.get<CoursesService>(CoursesService);
    prismaService = module.get<PrismaService>(PrismaService);

    // Mock price thresholds with empty array by default
    jest
      .spyOn(prismaService.coursePriceThreshold, 'findMany')
      .mockResolvedValue([]);

    // Spy on the calculateDistance method
    jest
      .spyOn(service as any, 'calculateDistance')
      .mockImplementation(
        (lat1: number, lon1: number, lat2: number, lon2: number): number => {
          // For testing purposes, we'll use a simple distance formula
          // that roughly approximates distances near London for our test data
          return (
            Math.sqrt(
              Math.pow(Number(lat2) - Number(lat1), 2) +
                Math.pow(Number(lon2) - Number(lon1), 2),
            ) * 111
          ); // Multiply by 111 to convert degrees to approximate km
        },
      );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findCoursesByLocation', () => {
    it('should find courses within the specified radius', async () => {
      // Arrange
      const dto: FindCoursesByLocationDto = {
        lat: 51.5,
        lng: -0.1,
        radius: 10,
      };

      const nearbyCoursesSubset = [
        mockCourses[0],
        mockCourses[1],
        mockCourses[2],
      ];

      jest
        .spyOn(prismaService.golfCourse, 'findMany')
        .mockResolvedValue(nearbyCoursesSubset);

      // Act
      const result = await service.findCoursesByLocation(dto);

      // Assert
      expect(prismaService.golfCourse.findMany).toHaveBeenCalledWith({
        where: {
          lat: {
            gte: Number(dto.lat) - Number(dto.radius) / 111,
            lte: Number(dto.lat) + Number(dto.radius) / 111,
          },
          lng: {
            gte: Number(dto.lng) - Number(dto.radius) / 111,
            lte: Number(dto.lng) + Number(dto.radius) / 111,
          },
          deleted_at: null,
          closed_down: false,
          is_bookable: true,
        },
        include: {
          tees: {
            where: { deleted_at: null },
            orderBy: { tee_name: 'desc' },
            include: {
              holes: {
                where: { deleted_at: null },
                orderBy: { number: 'asc' },
              },
            },
          },
        },
      });

      // Expect all nearby courses to be returned
      expect(result.length).toBe(3);
      expect(result.map((course) => course.id)).toEqual(['1', '2', '3']);
    });

    it('should filter out courses outside the exact radius', async () => {
      // Arrange
      const dto: FindCoursesByLocationDto = {
        lat: 51.5,
        lng: -0.1,
        radius: 5, // Smaller radius
      };

      // Return all courses from the database query
      jest
        .spyOn(prismaService.golfCourse, 'findMany')
        .mockResolvedValue(mockCourses);

      // Mock calculateDistance to return specific distances for our test courses
      // Override the mock implementation just for this test
      (service as any).calculateDistance = jest
        .fn()
        .mockImplementation((lat1, lon1, lat2, lon2) => {
          // Course 1: 0 km (same location)
          if (lat2 === 51.5 && lon2 === -0.1) return 0;
          // Course 2: 3 km
          if (lat2 === 51.52 && lon2 === -0.12) return 3;
          // Course 3: 7 km
          if (lat2 === 51.55 && lon2 === -0.15) return 7;
          // Course 4: 80 km
          if (lat2 === 52.0 && lon2 === -1.0) return 80;
          return 999; // Default fallback
        });

      // Act
      const result = await service.findCoursesByLocation(dto);

      // Assert
      // Only courses within 5km should be returned (Course 1 and Course 2)
      expect(result.length).toBe(2);
      expect(result.map((course) => course.id)).toEqual(['1', '2']);
    });

    it('should sort courses by distance (closest first)', async () => {
      // Arrange
      const dto: FindCoursesByLocationDto = {
        lat: 51.5,
        lng: -0.1,
        radius: 10,
      };

      // Return courses in unsorted order
      jest.spyOn(prismaService.golfCourse, 'findMany').mockResolvedValue([
        mockCourses[2], // Course C (farthest of the 3)
        mockCourses[0], // Course A (closest)
        mockCourses[1], // Course B (middle)
      ]);

      // Mock calculateDistance to return specific distances
      (service as any).calculateDistance = jest
        .fn()
        .mockImplementation((lat1, lon1, lat2, lon2) => {
          // Course A: 0 km (same location)
          if (lat2 === 51.5 && lon2 === -0.1) return 0;
          // Course B: 3 km
          if (lat2 === 51.52 && lon2 === -0.12) return 3;
          // Course C: 7 km
          if (lat2 === 51.55 && lon2 === -0.15) return 7;
          return 999; // Default fallback
        });

      // Act
      const result = await service.findCoursesByLocation(dto);

      // Assert
      // Courses should be sorted by distance (Course A, B, C)
      expect(result.length).toBe(3);
      expect(result.map((course) => course.id)).toEqual(['1', '2', '3']);
    });

    it('should handle empty results', async () => {
      // Arrange
      const dto: FindCoursesByLocationDto = {
        lat: 55.0,
        lng: 5.0, // Far away from any courses
        radius: 10,
      };

      jest.spyOn(prismaService.golfCourse, 'findMany').mockResolvedValue([]);

      // Act
      const result = await service.findCoursesByLocation(dto);

      // Assert
      expect(result).toEqual([]);
    });

    it('should filter out courses with null coordinates', async () => {
      // Arrange
      const dto: FindCoursesByLocationDto = {
        lat: 51.5,
        lng: -0.1,
        radius: 10,
      };

      const coursesWithNullCoords = [
        mockCourses[0],
        { ...mockCourses[1], lat: null }, // Missing latitude
        { ...mockCourses[2], lng: null }, // Missing longitude
      ];

      jest
        .spyOn(prismaService.golfCourse, 'findMany')
        .mockResolvedValue(coursesWithNullCoords);

      // Act
      const result = await service.findCoursesByLocation(dto);

      // Assert
      // Only course with valid coordinates should be returned
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('1');
    });
  });

  describe('findAllPaginated', () => {
    it('should return paginated courses with correct metadata', async () => {
      // Arrange
      const mockCourseDetails = [
        {
          id: '1',
          name: 'Course A',
          lat: 51.5,
          lng: -0.1,
          address: 'London',
          saturday_9am_cost_pence: 5000,
          is_bookable: true,
          closed_down: false,
          booking_url: null,
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
          tees: [],
        },
        {
          id: '2',
          name: 'Course B',
          lat: 51.52,
          lng: -0.12,
          address: 'London',
          saturday_9am_cost_pence: 6000,
          is_bookable: true,
          closed_down: false,
          booking_url: null,
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
          tees: [],
        },
      ];

      jest.spyOn(prismaService.golfCourse, 'count').mockResolvedValue(50);

      jest
        .spyOn(prismaService.golfCourse, 'findMany')
        .mockResolvedValue(mockCourseDetails);

      const paginateDto = { page: 1, limit: 20 };

      // Act
      const result = await service.findAllPaginated(paginateDto);

      // Assert
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
      expect(result.pagination.total).toBe(50);
      expect(result.pagination.totalPages).toBe(3);
      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.hasPreviousPage).toBe(false);
      expect(result.data.length).toBe(2);
    });

    it('should calculate correct skip value based on page number', async () => {
      // Arrange
      jest.spyOn(prismaService.golfCourse, 'count').mockResolvedValue(100);

      jest.spyOn(prismaService.golfCourse, 'findMany').mockResolvedValue([]);

      const paginateDto = { page: 3, limit: 20 };

      // Act
      await service.findAllPaginated(paginateDto);

      // Assert
      expect(prismaService.golfCourse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 40,
          take: 20,
        }),
      );
    });

    it('should set hasNextPage to false on last page', async () => {
      // Arrange
      jest.spyOn(prismaService.golfCourse, 'count').mockResolvedValue(40);

      jest.spyOn(prismaService.golfCourse, 'findMany').mockResolvedValue([]);

      const paginateDto = { page: 2, limit: 20 };

      // Act
      const result = await service.findAllPaginated(paginateDto);

      // Assert
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.hasPreviousPage).toBe(true);
      expect(result.pagination.totalPages).toBe(2);
    });

    it('should use default values when not provided', async () => {
      // Arrange
      jest.spyOn(prismaService.golfCourse, 'count').mockResolvedValue(50);

      jest.spyOn(prismaService.golfCourse, 'findMany').mockResolvedValue([]);

      const paginateDto = {};

      // Act
      const result = await service.findAllPaginated(paginateDto as any);

      // Assert
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
      expect(prismaService.golfCourse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
        }),
      );
    });

    it('should throw error on database failure', async () => {
      // Arrange
      jest
        .spyOn(prismaService.golfCourse, 'count')
        .mockRejectedValue(new Error('Database error'));

      const paginateDto = { page: 1, limit: 20 };

      // Act & Assert
      await expect(service.findAllPaginated(paginateDto)).rejects.toThrow();
    });
  });
});
