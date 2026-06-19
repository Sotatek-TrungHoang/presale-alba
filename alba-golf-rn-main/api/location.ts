import axios from "axios";
import { buildApiUrl, DEFAULT_CONFIG } from "./config";

// Define types
export type Location = {
  latitude: number;
  longitude: number;
  description?: string;
};

// Helper function for making API calls
const apiClient = axios.create(DEFAULT_CONFIG);

/**
 * Search for locations by query (geocoding service)
 */
export const searchLocations = async (query: string): Promise<Location[]> => {
  try {
    const response = await apiClient.get(buildApiUrl("locations"), {
      params: { searchTerm: query },
    });

    // Map the API response format to our Location type
    const locations = response.data || [];
    return locations.map((location: any) => {
      // The API returns coordinates as [longitude, latitude] array
      const coordinates = location.coordinates || [0, 0];

      return {
        // coordinates[1] is latitude, coordinates[0] is longitude
        latitude: typeof coordinates[1] === "number" ? coordinates[1] : 0,
        longitude: typeof coordinates[0] === "number" ? coordinates[0] : 0,
        description: location.name || `Location ${query}`,
      };
    });
  } catch (error) {
    console.error("Error searching locations:", error);
    // Return mock data in case of error
    return [
      {
        latitude: 40.7128,
        longitude: -74.006,
        description: `Search result for: ${query}`,
      },
    ];
  }
};

// Define types for address components
export type AddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

export type DetailedLocation = {
  latitude: number;
  longitude: number;
  description?: string;
  address_components?: AddressComponent[];
};

/**
 * Search for locations by query and return detailed address components (geocoding service)
 */
export const searchAddressComponents = async (
  query: string
): Promise<DetailedLocation[]> => {
  try {
    const response = await apiClient.get(buildApiUrl("locations"), {
      params: { searchTerm: query, address_components: true }, // Assuming your API can take a param to return components
    });

    // Map the API response format to our DetailedLocation type
    const locations = response.data || [];
    return locations.map((location: any) => {
      const coordinates = location.coordinates || [0, 0];
      return {
        latitude: typeof coordinates[1] === "number" ? coordinates[1] : 0,
        longitude: typeof coordinates[0] === "number" ? coordinates[0] : 0,
        description: location.name || `Location ${query}`,
        address_components: location.addressComponents || [],
      };
    });
  } catch (error) {
    console.error("Error searching detailed locations:", error);
    // Return mock data in case of error, including example address_components
    return [
      {
        latitude: 40.7128,
        longitude: -74.006,
        description: `Search result for: ${query}`,
        address_components: [
          { long_name: "1600", short_name: "1600", types: ["street_number"] },
          {
            long_name: "Amphitheatre Pkwy",
            short_name: "Amphitheatre Pkwy",
            types: ["route"],
          },
          {
            long_name: "Mountain View",
            short_name: "Mountain View",
            types: ["locality", "political"],
          },
          {
            long_name: "Santa Clara County",
            short_name: "Santa Clara County",
            types: ["administrative_area_level_2", "political"],
          },
          {
            long_name: "California",
            short_name: "CA",
            types: ["administrative_area_level_1", "political"],
          },
          {
            long_name: "United States",
            short_name: "US",
            types: ["country", "political"],
          },
          { long_name: "94043", short_name: "94043", types: ["postal_code"] },
        ],
      },
    ];
  }
};
