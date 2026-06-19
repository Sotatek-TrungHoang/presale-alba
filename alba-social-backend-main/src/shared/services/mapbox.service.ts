import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Location } from '../interfaces/search-result.interface';

@Injectable()
export class MapboxService {
  private geocodingClient: any;

  constructor(private configService: ConfigService) {
    const accessToken = this.configService.get<string>('MAPBOX_ACCESS_TOKEN');
    if (accessToken) {
      const mbxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');
      this.geocodingClient = mbxGeocoding({ accessToken });
    } else {
      console.warn(
        'Mapbox geocoding is not available. Check your access token.',
      );
    }
  }

  async searchLocations(searchTerm: string): Promise<Location[]> {
    if (!this.geocodingClient) {
      return [];
    }

    try {
      const response = await this.geocodingClient
        .forwardGeocode({
          query: searchTerm,
          limit: 5,
          types: ['place', 'locality', 'neighborhood', 'address'],
          countries: ['gb'],
          language: ['en-GB'],
        })
        .send();

      return response.body.features
        .map((feature: any): Location | null => {
          if (this.isValidCoordinates(feature.center)) {
            return {
              id: feature.id,
              name: feature.place_name,
              type: 'location',
              coordinates: feature.center,
            };
          }
          return null;
        })
        .filter(
          (location: Location | null): location is Location =>
            location !== null,
        );
    } catch (error) {
      console.error('Error searching locations:', error);
      return [];
    }
  }

  private isValidCoordinates(
    coordinates: any,
  ): coordinates is [number, number] {
    return (
      Array.isArray(coordinates) &&
      coordinates.length === 2 &&
      typeof coordinates[0] === 'number' &&
      typeof coordinates[1] === 'number'
    );
  }
}
