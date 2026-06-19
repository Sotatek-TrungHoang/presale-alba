import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Client,
  GeocodeRequest,
  GeocodeResponse,
  AddressComponent as GoogleAddressComponent,
} from '@googlemaps/google-maps-services-js';
import {
  Location,
  AddressComponent,
} from '../interfaces/search-result.interface';

@Injectable()
export class GoogleMapsService {
  private client: Client;

  constructor(private configService: ConfigService) {
    this.client = new Client({});
  }

  async searchLocations(searchTerm: string): Promise<Location[]> {
    const apiKey = this.configService.get<string>('GOOGLE_MAPS_API_KEY');

    if (!apiKey) {
      console.warn(
        'Google Maps geocoding is not available. Check your API key.',
      );
      return [];
    }

    try {
      const request: GeocodeRequest = {
        params: {
          address: searchTerm,
          key: apiKey,
          components: 'country:gb', // Limit to United Kingdom
          language: 'en-GB',
        },
      };

      const response = await this.client.geocode(request);

      return this.parseGoogleMapsResponse(response);
    } catch (error) {
      console.error('Error searching locations with Google Maps:', error);
      return [];
    }
  }

  private parseGoogleMapsResponse(response: GeocodeResponse): Location[] {
    if (
      response.status !== 200 ||
      !response.data.results ||
      response.data.results.length === 0
    ) {
      return [];
    }

    return response.data.results
      .map((result): Location | null => {
        const { lat, lng } = result.geometry.location;

        if (this.isValidCoordinates([lng, lat])) {
          const addressComponents: AddressComponent[] =
            result.address_components.map(
              (component: GoogleAddressComponent) => ({
                long_name: component.long_name,
                short_name: component.short_name,
                types: component.types,
              }),
            );

          return {
            id: result.place_id,
            name: result.formatted_address,
            type: 'location',
            coordinates: [lng, lat],
            addressComponents: addressComponents,
          };
        }
        return null;
      })
      .filter(
        (location: Location | null): location is Location => location !== null,
      )
      .slice(0, 5);
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
