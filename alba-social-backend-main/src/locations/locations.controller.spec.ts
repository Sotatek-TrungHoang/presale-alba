import { Test, TestingModule } from '@nestjs/testing';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';
import { SearchLocationsDto } from './dto/search-location.dto';

describe('LocationsController', () => {
  let controller: LocationsController;
  let locationsService: LocationsService;

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
      controllers: [LocationsController],
      providers: [
        {
          provide: LocationsService,
          useValue: {
            searchLocations: jest.fn().mockResolvedValue(mockLocations),
          },
        },
      ],
    }).compile();

    controller = module.get<LocationsController>(LocationsController);
    locationsService = module.get<LocationsService>(LocationsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('searchLocations', () => {
    it('should call locationsService.searchLocations with the correct searchLocationsDto', async () => {
      const searchLocationsDto: SearchLocationsDto = { searchTerm: 'London' };

      await controller.searchLocations(searchLocationsDto);

      expect(locationsService.searchLocations).toHaveBeenCalledWith(
        searchLocationsDto,
      );
    });

    it('should return the locations from locationsService', async () => {
      const searchLocationsDto: SearchLocationsDto = { searchTerm: 'London' };

      const result = await controller.searchLocations(searchLocationsDto);

      expect(result).toEqual(mockLocations);
    });

    it('should handle empty search results', async () => {
      jest.spyOn(locationsService, 'searchLocations').mockResolvedValue([]);

      const searchLocationsDto: SearchLocationsDto = {
        searchTerm: 'NonExistentPlace',
      };
      const result = await controller.searchLocations(searchLocationsDto);

      expect(result).toEqual([]);
    });
  });
});
