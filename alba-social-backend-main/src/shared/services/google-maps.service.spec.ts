import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GoogleMapsService } from './google-maps.service';

describe('GoogleMapsService', () => {
  let service: GoogleMapsService;
  let configService: ConfigService;

  // Mock Google Maps client response
  const mockGeocodeResponse = {
    status: 200,
    data: {
      results: [
        {
          place_id: 'test-place-id',
          formatted_address: 'London, UK',
          geometry: {
            location: {
              lat: 51.5072178,
              lng: -0.1275862,
            },
          },
          address_components: [
            {
              long_name: 'London',
              short_name: 'London',
              types: ['locality', 'political'],
            },
            {
              long_name: 'United Kingdom',
              short_name: 'GB',
              types: ['country', 'political'],
            },
          ],
        },
      ],
      status: 'OK',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleMapsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key) => {
              if (key === 'GOOGLE_MAPS_API_KEY') {
                return 'test-api-key';
              }
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<GoogleMapsService>(GoogleMapsService);
    configService = module.get<ConfigService>(ConfigService);

    // Mock the geocode method
    service['client'] = {
      geocode: jest.fn().mockResolvedValue(mockGeocodeResponse),
    } as any;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('searchLocations', () => {
    it('should return locations when search is successful', async () => {
      const result = await service.searchLocations('London');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'test-place-id',
        name: 'London, UK',
        type: 'location',
        coordinates: [-0.1275862, 51.5072178],
        addressComponents: [
          {
            long_name: 'London',
            short_name: 'London',
            types: ['locality', 'political'],
          },
          {
            long_name: 'United Kingdom',
            short_name: 'GB',
            types: ['country', 'political'],
          },
        ],
      });

      expect(service['client'].geocode).toHaveBeenCalledWith({
        params: {
          address: 'London',
          key: 'test-api-key',
          components: 'country:gb',
          language: 'en-GB',
        },
      });
    });

    it('should return empty array when API key is missing', async () => {
      jest.spyOn(configService, 'get').mockReturnValue(undefined);

      const result = await service.searchLocations('London');

      expect(result).toEqual([]);
      expect(service['client'].geocode).not.toHaveBeenCalled();
    });

    it('should return empty array when API call fails', async () => {
      service['client'].geocode = jest
        .fn()
        .mockRejectedValue(new Error('API error'));

      const result = await service.searchLocations('London');

      expect(result).toEqual([]);
    });

    it('should handle empty results correctly', async () => {
      service['client'].geocode = jest.fn().mockResolvedValue({
        status: 200,
        data: {
          results: [],
          status: 'ZERO_RESULTS',
        },
      });

      const result = await service.searchLocations('NonExistentPlace');

      expect(result).toEqual([]);
    });
  });
});
