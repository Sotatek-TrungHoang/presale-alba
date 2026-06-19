import { getIdToken, User } from "firebase/auth";
import { buildApiUrl, DEFAULT_CONFIG } from "./config";
import axios from "axios";
import { auth } from "@/firebase.config";

// --- Enums (matching Prisma schema) ---
export enum HandicapRange {
  LOW = "LOW",
  MID = "MID",
  HIGH = "HIGH",
  DONT_KNOW = "DONT_KNOW",
}

export enum PlayerType {
  CASUAL_PLAYER = "CASUAL_PLAYER",
  DEDICATED_IMPROVER = "DEDICATED_IMPROVER",
  SERIOUS_COMPETITOR = "SERIOUS_COMPETITOR",
  NEW_TO_GOLF = "NEW_TO_GOLF",
}

export enum GameType {
  PURELY_SOCIAL = "PURELY_SOCIAL",
  RELAXED_ROUND = "RELAXED_ROUND",
  COMPETITIVE_MATCH = "COMPETITIVE_MATCH",
  BEGINNER_FRIENDLY = "BEGINNER_FRIENDLY",
}

export enum TimeSlot {
  EARLY_MORNING = "EARLY_MORNING",
  LATE_MORNING = "LATE_MORNING",
  LUNCHTIME = "LUNCHTIME",
  LATE_AFTERNOON = "LATE_AFTERNOON",
  EVENING = "EVENING",
}

// --- DTOs (matching backend) ---
export interface AvailabilityDto {
  weekdays?: TimeSlot[];
  weekends?: TimeSlot[];
}

export interface UserStats {
  gamesPlayed: number;
  gamesOrganized: number;
  followers: number;
}

export interface CreateUserWithOnboardingDto {
  // Basic user data
  auth_id: string;
  email: string;
  admin_status: boolean; // Assuming false for new signups
  first_name: string;
  last_name: string;

  // Onboarding data
  handicapRange: HandicapRange;
  playerType: PlayerType;
  preferences: GameType[];
  availability?: AvailabilityDto;
  homeCourses?: string[]; // Array of course IDs
}

// Updated DTO for searching users, matching backend SearchUsersDto
export interface SearchUsersApiDto {
  searchTerm?: string;
  lat?: number;
  lng?: number;
  distance?: number; // 0-50 km
  handicapRanges?: HandicapRange[];
  playerTypes?: PlayerType[];
  gamePreferences?: GameType[]; // Renamed from preferences for backend consistency
  limit?: number; // 1-50
}

export interface UserProfileDto {
  firstName?: string;
  lastName?: string;
  photo?: string;
  handicapRange?: HandicapRange;
  playerType?: PlayerType;
  preferences?: GameType[];
  availability?: AvailabilityDto;
  homeCourses?: string[];
}

export interface GetPresignedUrlDto {
  fileName: string;
  fileType: string;
}

export interface UserProfileWithStatsDto {
  profile: {
    first_name?: string;
    last_name?: string;
    photo?: string;
    // ...other profile fields
  };
  onboarding: {
    handicap_range?: HandicapRange;
    player_type?: PlayerType;
    preferences?: GameType[];
    availability?: {
      time_slots?: any[]; // Replace 'any' with a specific type if available
    };
    // ...other onboarding fields
  };
  stats: {
    gamesPlayed: number;
    gamesOrganized: number;
    followers: number;
  };
  _count?: {
    followers?: number;
    // ...other count fields
  };
  // ...any other top-level fields from your backend
}

const getFirebaseAuthToken = async (
  forceRefresh: boolean = false
): Promise<string> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.error("getFirebaseAuthToken: No user currently authenticated.");
    throw new Error("Authentication required. Please log in.");
  }
  try {
    const idToken = await getIdToken(currentUser, forceRefresh);
    return idToken;
  } catch (error: any) {
    console.error("getFirebaseAuthToken: Error getting ID token:", error);
    console.error("Error code:", error?.code);
    console.error("Error message:", error?.message);
    throw new Error("Could not verify authentication. Please log in again.");
  }
};

const apiClient = axios.create(DEFAULT_CONFIG);

apiClient.interceptors.request.use(
  async (config) => {
    const token = await getFirebaseAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const createUser = async (user: User) => {
  const response = await apiClient.post(buildApiUrl("users"), user);
  return response.data;
};

export const getUser = async () => {
  try {
    const response = await apiClient.get(buildApiUrl(`users/me`));
    return response.data;
  } catch (error) {
    console.error("Error fetching user:", error);
    // Handle specific error responses if needed
    if (axios.isAxiosError(error) && error.response) {
      console.error("Backend error data:", error.response.data);
      throw new Error(
        error.response.data.message || "Fetching user failed on the backend."
      );
    } else {
      throw new Error("An unexpected error occurred while fetching user.");
    }
  }
};

export const updateUser = async (uid: string, user: User) => {
  const response = await apiClient.put(buildApiUrl(`users/${uid}`), user);
  return response.data;
};

export const deleteUser = async (uid: string) => {
  const response = await apiClient.delete(buildApiUrl(`users/${uid}`));
  return response.data;
};

export const deleteCurrentUserAccount = async () => {
  const response = await apiClient.delete(buildApiUrl("users/me"));
  return response.data;
};

export const getUsersFavouriteCourses = async (uid: string) => {
  try {
    const response = await apiClient.get(
      buildApiUrl(`users/${uid}/favourite-courses-details`)
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching favourite courses:", error);
    throw new Error(
      "An unexpected error occurred while fetching favourite courses."
    );
  }
};

export const getAllUsers = async () => {
  try {
    const response = await apiClient.get(buildApiUrl("users"));
    return response.data;
  } catch (error) {
    console.error("Error fetching all users:", error);
    if (axios.isAxiosError(error) && error.response) {
      console.error("Backend error data:", error.response.data);
      throw new Error(
        error.response.data.message ||
          "Fetching all users failed on the backend."
      );
    } else {
      throw new Error("An unexpected error occurred while fetching all users.");
    }
  }
};

export const searchGolfers = async (params: SearchUsersApiDto) => {
  try {
    const filteredParams: { [key: string]: any } = {};
    for (const key of Object.keys(params) as Array<keyof SearchUsersApiDto>) {
      if (params[key] !== undefined) {
        filteredParams[key] = params[key];
      }
    }

    const response = await apiClient.get(buildApiUrl("users/search"), {
      params: filteredParams,
    });
    return response.data;
  } catch (error) {
    console.error("Error searching golfers:", error);
    if (axios.isAxiosError(error) && error.response) {
      console.error("Backend error data:", error.response.data);
      throw new Error(
        error.response.data.message ||
          "Searching golfers failed on the backend."
      );
    } else {
      throw new Error("An unexpected error occurred while searching golfers.");
    }
  }
};

/**
 * Sign up a new user with onboarding data
 */
export const signupWithOnboarding = async (
  data: CreateUserWithOnboardingDto
) => {
  try {
    const response = await apiClient.post(
      buildApiUrl("users/signup-with-onboarding"),
      data
    );
    return response.data; // Return the created user data (including profile, onboarding, etc.)
  } catch (error) {
    console.error("Error during signup with onboarding:", error);
    // Handle specific error responses if needed
    if (axios.isAxiosError(error) && error.response) {
      console.error("Backend error data:", error.response.data);
      throw new Error(
        error.response.data.message || "Signup failed on the backend."
      );
    } else {
      throw new Error("An unexpected error occurred during signup.");
    }
  }
};

export const getPresignedUrl = async (dto: GetPresignedUrlDto) => {
  try {
    const response = await apiClient.post(buildApiUrl("images/"), dto);
    return response.data;
  } catch (error) {
    console.error("Error fetching presigned URL:", error);
    throw new Error(
      "An unexpected error occurred while fetching presigned URL."
    );
  }
};

export const updateUserProfile = async (profileData: UserProfileDto) => {
  try {
    const response = await apiClient.patch(
      buildApiUrl("profiles/user-profile"),
      profileData
    );
    return response.data;
  } catch (error) {
    console.error("Error updating user profile:", error);
    throw new Error(
      "An unexpected error occurred while updating user profile."
    );
  }
};

export const getUserProfile = async (uid: string) => {
  try {
    const response = await apiClient.get(buildApiUrl(`users/${uid}`));
    return response.data;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    throw new Error(
      "An unexpected error occurred while fetching user profile."
    );
  }
};

export const updateUserLocation = async (lat: number, lng: number) => {
  try {
    const response = await apiClient.patch(buildApiUrl("users/location"), {
      lat,
      lng,
    });
    return response.data;
  } catch (error) {
    console.error("Error updating user location:", error);
    throw error;
  }
};
