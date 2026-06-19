import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { ConfigService } from '@nestjs/config';
import { LocationsModule } from '../src/locations/locations.module';
import { GoogleMapsService } from '../src/shared/services/google-maps.service';

describe('LocationsController (e2e)', () => {
  let app: INestApplication;

  const mockLocations = [
    {
      id: 'test-place-id',
      name: 'London, UK',
      type: 'location',
      coordinates: [-0.1275862, 51.5072178],
    },
  ];

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [LocationsModule],
    })
      .overrideProvider(GoogleMapsService)
      .useValue({
        searchLocations: jest.fn().mockResolvedValue(mockLocations),
      })
      .overrideProvider(ConfigService)
      .useValue({
        get: jest.fn((key) => {
          if (key === 'GOOGLE_MAPS_API_KEY') {
            return 'test-api-key';
          }
          return null;
        }),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/locations (GET) with searchTerm', () => {
    return request(app.getHttpServer())
      .get('/locations?searchTerm=London')
      .expect(200)
      .expect(mockLocations);
  });

  it('/locations (GET) with empty searchTerm should return 400', () => {
    return request(app.getHttpServer())
      .get('/locations?searchTerm=')
      .expect(400); // Now expecting 400 because our validation rejects empty strings
  });

  it('/locations (GET) without searchTerm should return 400', () => {
    return request(app.getHttpServer()).get('/locations').expect(400);
  });
});
