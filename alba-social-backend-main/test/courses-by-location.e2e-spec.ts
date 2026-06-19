import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from 'src/prisma/prisma.service';
import { MapboxService } from 'src/shared/services/mapbox.service';
import { GoogleMapsService } from '../src/shared/services/google-maps.service';
import { GolfCourse } from '@prisma/client';
import { CoursesService } from 'src/courses/courses.service';
import { CoursesController } from 'src/courses/courses.controller';
import { FirebaseService } from 'src/firebase/firebase.service';
import { FirebaseAuthGuard } from 'src/guards/firebase-auth.guard';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

describe('Courses - Find by Location (e2e)', () => {
  let app: INestApplication;
  let prismaService: any;

  // Mock golf courses for the test
  const mockCourses: Partial<GolfCourse>[] = [
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
      address: 'Central London',
      deleted_at: null,
    },
    {
      id: '3',
      name: 'Course C',
      lat: 51.55,
      lng: -0.15,
      address: 'North London',
      deleted_at: null,
    },
  ];

  beforeEach(async () => {
    // Create a mock PrismaService
    const mockPrismaService = {
      coursePriceThreshold: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      golfCourse: {
        findMany: jest.fn().mockImplementation(async (params) => {
          // Simple filter implementation to mimic the database query
          const { lat, lng } = params.where;
          return mockCourses.filter(
            (course) =>
              course.lat >= lat.gte &&
              course.lat <= lat.lte &&
              course.lng >= lng.gte &&
              course.lng <= lng.lte &&
              course.deleted_at === null,
          );
        }),
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [CoursesController],
      providers: [
        CoursesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: MapboxService,
          useValue: {
            searchLocations: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: GoogleMapsService,
          useValue: {
            geocode: jest.fn(),
            searchNearby: jest.fn(),
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            reset: jest.fn(),
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

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    prismaService = moduleFixture.get<PrismaService>(PrismaService);

    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/courses/by-location (GET) should return courses within radius', () => {
    // Because we're mocking the database query, we don't actually
    // need to test the Haversine formula calculation here - that's covered by unit tests.
    // We just need to ensure the API endpoint works correctly.

    return request(app.getHttpServer())
      .get('/courses/by-location?lat=51.5&lng=-0.1&radius=10')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);

        // Verify basic structure of returned courses
        expect(res.body[0]).toHaveProperty('id');
        expect(res.body[0]).toHaveProperty('name');
        expect(res.body[0]).toHaveProperty('lat');
        expect(res.body[0]).toHaveProperty('lng');
        expect(res.body[0]).toHaveProperty('address');
      });
  });

  it('/courses/by-location (GET) should handle empty results', () => {
    // Override the findMany mock to return empty array for this test
    prismaService.golfCourse.findMany.mockResolvedValueOnce([]);

    return request(app.getHttpServer())
      .get('/courses/by-location?lat=90.0&lng=180.0&radius=5')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBe(0);
      });
  });

  it('/courses/by-location (GET) should validate query parameters', () => {
    return request(app.getHttpServer())
      .get('/courses/by-location?lat=invalid&lng=-0.1&radius=10')
      .expect(400); // Should return 400 for invalid parameters
  });

  it('/courses/by-location (GET) should respect radius limit', () => {
    return request(app.getHttpServer())
      .get('/courses/by-location?lat=51.5&lng=-0.1&radius=2000')
      .expect(400); // Should return 400 for radius > max (1000)
  });
});
