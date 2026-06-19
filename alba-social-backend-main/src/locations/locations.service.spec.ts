import { Test, TestingModule } from '@nestjs/testing';
import { LocationsService } from './locations.service';
import { GoogleMapsService } from '../shared/services/google-maps.service';
import { SearchLocationsDto } from './dto/search-location.dto';

describe('LocationsService', () => {
  let service: LocationsService;
  let googleMapsService: GoogleMapsService;

  const mockLocations = [
    {
      id: 'test-place-id',
      name: 'London, UK',
      type: 'location',
      coordinates: [-0.1275862, 51.5072178],
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationsService,
        {
          provide: GoogleMapsService,
          useValue: {
            searchLocations: jest.fn().mockResolvedValue(mockLocations),
          },
        },
      ],
    }).compile();

    service = module.get<LocationsService>(LocationsService);
    googleMapsService = module.get<GoogleMapsService>(GoogleMapsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('searchLocations', () => {
    it('should call googleMapsService.searchLocations with the correct searchTerm', async () => {
      const searchLocationsDto: SearchLocationsDto = { searchTerm: 'London' };

      await service.searchLocations(searchLocationsDto);

      expect(googleMapsService.searchLocations).toHaveBeenCalledWith('London');
    });

    it('should return the locations from googleMapsService', async () => {
      const searchLocationsDto: SearchLocationsDto = { searchTerm: 'London' };

      const result = await service.searchLocations(searchLocationsDto);

      expect(result).toEqual(mockLocations);
    });

    it('should handle empty search results', async () => {
      jest.spyOn(googleMapsService, 'searchLocations').mockResolvedValue([]);

      const searchLocationsDto: SearchLocationsDto = {
        searchTerm: 'NonExistentPlace',
      };
      const result = await service.searchLocations(searchLocationsDto);

      expect(result).toEqual([]);
    });
  });
});
