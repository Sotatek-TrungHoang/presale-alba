import { buildApiUrl, DEFAULT_CONFIG, USE_MOCK_DATA } from "./config";
import axios from "axios";

// Define Location type if not already defined elsewhere
export type Location = {
  latitude: number;
  longitude: number;
  description?: string; // Optional description like in search results
};

export type LocationResult = {
  coordinates: {
    latitude: number;
    longitude: number;
  };
  name: string;
};

export type GolfCourse = {
  id: string;
  name: string;
  location?: Location; // Made optional
  lat?: number; // Added for direct latitude
  lng?: number; // Added for direct longitude
  distance?: number; // e.g. "2.3 miles away"
  address?: string;
  price_rating?: number; // Added
  num_holes?: number; // Added
  course_par?: number; // Added
  course_slope?: number | null; // Added, can be null
};

// Helper function for making API calls
const apiClient = axios.create(DEFAULT_CONFIG);

// Mock data for testing (only used when USE_MOCK_DATA is true)
const MOCK_COURSES: GolfCourse[] = [
  {
    id: "1",
    name: "Pebble Beach Golf Links",
    lat: 36.5683,
    lng: -121.9497,
    distance: 2.3,
    address: "1700 17-Mile Drive, Pebble Beach, CA 93953",
    price_rating: 4,
    num_holes: 18,
    course_par: 72,
    course_slope: 144,
  },
  {
    id: "2",
    name: "Augusta National Golf Club",
    lat: 33.5021,
    lng: -82.0228,
    distance: 5.1,
    address: "2604 Washington Rd, Augusta, GA 30904",
    price_rating: 5,
    num_holes: 18,
    course_par: 72,
    course_slope: 137,
  },
  {
    id: "3",
    name: "St. Andrews Old Course",
    lat: 56.3398,
    lng: -2.7967,
    distance: 8.7,
    address: "St Andrews KY16 9SF, United Kingdom",
    price_rating: 4,
    num_holes: 18,
    course_par: 72,
    course_slope: 132,
  },
  {
    id: "4",
    name: "Central Park Golf Course",
    lat: 40.7128,
    lng: -74.006,
    distance: 1.2,
    address: "Central Park, New York, NY 10024",
    price_rating: 2,
    num_holes: 9,
    course_par: 36,
    course_slope: 110,
  },
  {
    id: "5",
    name: "Brooklyn Golf Course",
    lat: 40.7589,
    lng: -73.9851,
    distance: 3.4,
    address: "Brooklyn, NY 11201",
    price_rating: 3,
    num_holes: 18,
    course_par: 72,
    course_slope: 125,
  },
  {
    id: "6",
    name: "Queens Golf Course",
    lat: 40.7505,
    lng: -73.9934,
    distance: 4.8,
    address: "Queens, NY 11101",
    price_rating: 2,
    num_holes: 18,
    course_par: 72,
    course_slope: 118,
  },
  {
    id: "7",
    name: "Manhattan Golf Club",
    lat: 40.7648,
    lng: -73.9808,
    distance: 2.1,
    address: "Manhattan, NY 10001",
    price_rating: 4,
    num_holes: 18,
    course_par: 72,
    course_slope: 135,
  },
  {
    id: "8",
    name: "Bronx Golf Course",
    lat: 40.8448,
    lng: -73.8648,
    distance: 6.2,
    address: "Bronx, NY 10451",
    price_rating: 2,
    num_holes: 18,
    course_par: 72,
    course_slope: 120,
  },
];

/**
 * Get all golf courses for map display
 * This uses the findAll endpoint to get all courses without location filtering
 */
export const getAllCoursesForMap = async (): Promise<GolfCourse[]> => {
  try {
    const response = await apiClient.get(buildApiUrl("courses"));

    const transformedCourses = response.data.map((course: any) => ({
      id: course.id,
      name: course.name,
      lat: course.lat,
      lng: course.lng,
      address: course.address,
      distance: undefined, // Will be calculated on the frontend if needed
      price_rating: course.price_rating,
      num_holes: course.num_holes,
      course_par: course.course_par,
      course_slope: course.course_slope,
    }));

    return transformedCourses;
  } catch (error) {
    console.error("Error fetching all courses:", error);
    throw error;
  }
};

/**
 * Get golf courses near a location
 */
export const getNearbyCourses = async (
  lat: number,
  lng: number,
  radius: number = 20 // default radius in km/miles
): Promise<GolfCourse[]> => {
  try {
    const response = await apiClient.get(buildApiUrl("courses/by-location"), {
      params: { lat, lng, radius },
    });

    return response.data;
  } catch (error) {
    console.error("Error fetching nearby courses:", error);
    throw error;
  }
};

export const getSearchedCourses = async (
  searchTerm: string
): Promise<GolfCourse[]> => {
  try {
    const response = await apiClient.get(buildApiUrl("courses/search"), {
      params: { searchTerm },
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching searched courses:", error);
    throw error;
  }
};

/**
 * Get all golf courses
 */
export const getAllCourses = async (): Promise<GolfCourse[]> => {
  try {
    const response = await apiClient.get(buildApiUrl("courses"));
    return response.data;
  } catch (error) {
    console.error("Error fetching all courses:", error);
    throw error;
  }
};

// --- User, Profile, Onboarding ---
export interface Profile {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  photo?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  handicap?: number | null;
}

export interface UserOnboarding {
  id: string;
  handicap_range: string;
  player_type: string;
  preferences: string[];
  onboarding_completed: boolean;
}

export interface User {
  id: string;
  profile?: Profile | null;
  onboarding?: UserOnboarding | null;
}

// --- FavouriteCourse ---
export interface FavouriteCourse {
  id: string;
  user: User;
}

// --- GamePlayer ---
export interface GamePlayer {
  id: string;
  user_id: string;
  user: User;
  status: string;
}

// --- Game ---
export interface Game {
  id: string;
  creator_id: string;
  creator: User;
  name?: string | null;
  date: string;
  time_slot: string;
  exact_time?: string | null;
  players_current: number;
  players_needed: number;
  course_id?: string;
  game_type: string;
  game_format?: string | null;
  players: GamePlayer[];
  status: string;
}

// --- CourseTee, TeeName, CourseHole ---
export interface CourseHole {
  id: string;
  number: number;
  yards: number;
  par: number;
  handicap: number;
}

export interface TeeName {
  id: string;
  name: string;
}

export interface CourseTee {
  id: string;
  tee_name: TeeName;
  rating?: number | null;
  slope?: number | null;
  holes: CourseHole[];
}

// --- CourseReview, CourseCondition ---
export interface CourseReview {
  id: string;
  user: User;
  rating?: number | null;
  comment?: string | null;
  created_at: string;
}

export interface CourseCondition {
  id: string;
  user: User;
  condition: string;
  details?: string | null;
  created_at: string;
}

// --- DetailedGolfCourse ---
export interface DetailedGolfCourse {
  id: string;
  name: string;
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  tees: CourseTee[];
  reviews: CourseReview[];
  condition_reports: CourseCondition[];
  favourites: FavouriteCourse[];
  games: Game[];
  // Optionally add other fields as needed
  price_rating?: number;
  num_holes?: number;
  course_par?: number;
  course_slope?: number | null;
}

/**
 * Get detailed information about a specific golf course
 */
export const getGolfCourseDetails = async (
  courseId: string
): Promise<DetailedGolfCourse> => {
  try {
    const response = await apiClient.get(buildApiUrl(`courses/${courseId}`));
    return response.data;
  } catch (error) {
    console.error("Error fetching golf course details:", error);
    throw error;
  }
};

export type CoursesAndLocationsSearchResult = {
  courses: GolfCourse[];
  locations: LocationResult[]; // using Location type defined earlier for coordinates + description
};

export const searchCoursesAndLocations = async (
  searchTerm: string
): Promise<CoursesAndLocationsSearchResult> => {
  try {
    const response = await apiClient.get(
      buildApiUrl("courses/search-with-location"),
      {
        params: { searchTerm },
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching courses and locations search:", error);
    throw error;
  }
};
