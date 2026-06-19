import { Injectable } from '@nestjs/common';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { SearchLocationsDto } from './dto/search-location.dto';
import { GoogleMapsService } from 'src/shared/services/google-maps.service';

@Injectable()
export class LocationsService {
  constructor(private googleMapsService: GoogleMapsService) {}

  async searchLocations(searchLocationsDto: SearchLocationsDto) {
    const { searchTerm } = searchLocationsDto;

    const locations = await this.googleMapsService.searchLocations(searchTerm);

    return locations;
  }
}
