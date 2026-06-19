import { GolfCourse } from '@prisma/client';

export interface AddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

export interface Location {
  id: string;
  name: string;
  type: 'location';
  coordinates: [number, number]; // [longitude, latitude]
  addressComponents?: AddressComponent[];
}

export interface AugmentedCourseDetails extends GolfCourse {
  price_rating?: number;
  num_holes?: number;
  course_par?: number;
  course_slope?: number | null;
}

export interface SearchResult {
  courses: AugmentedCourseDetails[];
  locations: Location[];
}
