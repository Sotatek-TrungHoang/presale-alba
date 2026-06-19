import axios from "axios";
import { DEFAULT_CONFIG, buildApiUrl } from "./config";
import { getIdToken } from "firebase/auth";
import { auth } from "@/firebase.config";

export type createGameDto = {
  course_id?: string;
  group_id?: string;
  date: Date;
  time_slot: "EARLY_MORNING" | "LATE_MORNING" | "LUNCHTIME" | "LATE_AFTERNOON";
  players_needed: number;
  players_current: number;
  invited_users?: string[];
  is_booked: boolean;
  game_type:
    | "PURELY_SOCIAL"
    | "RELAXED_ROUND"
    | "COMPETITIVE_MATCH"
    | "BEGINNER_FRIENDLY";
  game_format?:
    | "MATCHPLAY"
    | "STROKEPLAY"
    | "SCRAMBLE"
    | "STABLEFORD"
    | "BEST_BALL"
    | "DONT_KNOW_YET";
  organiser_handicap: "LOW" | "MID" | "HIGH" | "DONT_KNOW";
};

// Add UpdateGameDto for editing games
export type UpdateGameDto = {
  name?: string | null;
  course_id?: string;
  date?: Date;
  time_slot?: "EARLY_MORNING" | "LATE_MORNING" | "LUNCHTIME" | "LATE_AFTERNOON";
  players_needed?: number;
  game_type?:
    | "PURELY_SOCIAL"
    | "RELAXED_ROUND"
    | "COMPETITIVE_MATCH"
    | "BEGINNER_FRIENDLY";
  game_format?:
    | "MATCHPLAY"
    | "STROKEPLAY"
    | "SCRAMBLE"
    | "STABLEFORD"
    | "BEST_BALL"
    | "DONT_KNOW_YET";
};

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
  } catch (error) {
    console.error("getFirebaseAuthToken: Error getting ID token:", error);
    throw new Error("Could not verify authentication. Please log in again.");
  }
};

const apiClient = axios.create(DEFAULT_CONFIG);

apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await getFirebaseAuthToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error(
        "Axios Interceptor: Failed to get auth token for request:",
        error
      );
      throw new Error("Failed to attach auth token");
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const createGame = async (game: createGameDto) => {
  try {
    const response = await apiClient.post(buildApiUrl("/games"), game);
    return response.data;
  } catch (error) {
    console.error("Error creating game:", error);
    throw error;
  }
};

export const getNearbyGames = async (
  latitude: number,
  longitude: number,
  radius: number,
  dateFrom?: Date,
  dateTo?: Date
) => {
  try {
    const params: any = { latitude, longitude, radius };

    // Add date parameters if provided
    if (dateFrom) {
      params.dateFrom = dateFrom.toISOString();
    }
    if (dateTo) {
      params.dateTo = dateTo.toISOString();
    }

    const response = await apiClient.get(buildApiUrl("/games/nearby"), {
      params,
    });
    const games = response.data;
    return games.map((game: any) => ({
      id: game.id,
      name: game.name ?? null,
      courseName: game.course.name,
      courseId: game.course.id,
      date: game.date,
      gameType: game.game_type,
      gameFormat: game.game_format,
      playersNeeded: game.players_needed,
      players: game.players,
      creatorId: game.creator_id,
      timeSlot: game.time_slot,
      status: game.status,
      exact_time: game.exact_time,
      costPerPlayer: game.cost_per_player ?? null,
      totalCost: game.total_cost ?? null,
      latestPlayerCreatedAt: game.latest_player_created_at ?? null,
    }));
  } catch (error) {
    console.error("Error getting nearby games:", error);
    throw error;
  }
};

export const getSuggestedGames = async (
  radius: number,
  dateFrom?: Date,
  dateTo?: Date,
  lat?: number,
  lng?: number
) => {
  try {
    const params: any = { radius };

    // Only include lat/lng if they are provided (for custom location)
    if (lat !== undefined && lng !== undefined) {
      params.lat = lat;
      params.lng = lng;
    }

    // Add date parameters if provided
    if (dateFrom) {
      params.dateFrom = dateFrom.toISOString();
    }
    if (dateTo) {
      params.dateTo = dateTo.toISOString();
    }

    const response = await apiClient.get(buildApiUrl("/games/suggested"), {
      params,
    });
    const games = response.data;
    return games.map((game: any) => ({
      id: game.id,
      name: game.name ?? null,
      courseName: game.course.name,
      courseId: game.course.id,
      date: game.date,
      gameType: game.game_type,
      gameFormat: game.game_format,
      playersNeeded: game.players_needed,
      players: game.players,
      creatorId: game.creator_id,
      timeSlot: game.time_slot,
      status: game.status,
      exact_time: game.exact_time,
      costPerPlayer: game.cost_per_player ?? null,
    }));
  } catch (error) {
    console.error("Error getting suggested games:", error);
    throw error;
  }
};

export const getGameById = async (id: string) => {
  try {
    const response = await apiClient.get(buildApiUrl(`/games/${id}`));
    return response.data;
  } catch (error) {
    console.error(`Error getting game by ID (${id}):`, error);
    throw error;
  }
};

export type UpdatePlayerStatusDto = {
  status: "APPROVED" | "REJECTED" | "CONFIRMED"; // Based on your NestJS DTO
  // Add any other fields your DTO might expect
};

export const updatePlayerStatusInGame = async (
  gameId: string,
  playerId: string, // This is the user_id of the player whose status is being updated
  dto: UpdatePlayerStatusDto
) => {
  try {
    const response = await apiClient.patch(
      buildApiUrl(`/games/${gameId}/players/${playerId}`),
      dto
    );
    return response.data;
  } catch (error) {
    console.error(
      `Error updating player status for player ${playerId} in game ${gameId}:`,
      error
    );
    throw error;
  }
};

// New DTO for joining a game
export interface JoinGameDto {
  gameId: string;
}

// Helper to transform game data - ensure this matches what your GameListing component needs
// and aligns with the structure returned by your backend's commonInclude.
const transformGameData = (game: any) => ({
  id: game.id,
  name: game.name ?? null,
  courseName: game.course?.name || "Course N/A", // Handle potential null course
  courseId: game.course?.id,
  selectedDate: game.date ? new Date(game.date).getTime() : null,
  gameType: game.game_type,
  gameFormat: game.game_format,
  playersNeeded: game.players_needed,
  // Ensure playersInGame matches the GamePlayer[] structure expected by GameListing
  // Your commonInclude in NestJS populates 'players'.
  playersInGame:
    game.players?.map((player: any) => ({
      user_id: player.user_id,
      user: {
        // Nested user object
        id: player.user?.id,
        profile: player.user?.profile
          ? {
              first_name: player.user.profile.first_name,
              photo: player.user.profile.photo,
            }
          : null,
      },
      status: player.status,
    })) || [],
  creatorId: game.creator_id,
  timeSlot: game.time_slot,
  status: game.status,
  exact_time: game.exact_time,
  // Add any other fields your GameListing might need directly from the game object
});

export type GameType = "pending" | "upcoming" | "completed";

export const getMyGames = async (type: GameType) => {
  try {
    const response = await apiClient.get(buildApiUrl("/games/my-games"), {
      params: { type },
    });
    return response.data.map(transformGameData);
  } catch (error) {
    console.error(`Error getting my ${type} games:`, error);
    throw error;
  }
};

export interface UserGameHistory {
  hasJoinedGames: boolean;
  hasCreatedGames: boolean;
}

export const getUserGameHistory = async (): Promise<UserGameHistory> => {
  try {
    const response = await apiClient.get(buildApiUrl("/games/user-history"));
    return response.data;
  } catch (error) {
    console.error("Error getting user game history:", error);
    throw error;
  }
};

// DTO for the new endpoint - ensure this matches your backend UpdateGameStatusDto
export interface ConfirmBookingDetailsDto {
  exact_time?: string; // e.g., "HH:MM"
  total_cost?: number;
  // Add other fields from UpdateGameStatusDto if they can be updated here
  // e.g., course_id, date, time_slot - but based on flow, only exact_time and total_cost are primary
}

export const confirmBookingDetails = async (
  gameId: string,
  dto: ConfirmBookingDetailsDto
) => {
  try {
    const response = await apiClient.patch(
      buildApiUrl(`/games/${gameId}/confirm`),
      dto
    );
    return response.data;
  } catch (error) {
    console.error(
      `Error confirming booking details for game ${gameId}:`,
      error
    );
    throw error;
  }
};

// New function to request to join a game
export const requestToJoinGame = async (gameId: string) => {
  try {
    const dto: JoinGameDto = { gameId };
    const response = await apiClient.post(buildApiUrl("/games/join"), dto);
    return response.data;
  } catch (error) {
    console.error(`Error requesting to join game ${gameId}:`, error);
    throw error;
  }
};

export interface GamePaymentDetails {
  playerShare: number;
  applicationFee: number;
  totalAmount: number;
  currency: string;
}

export const getGamePaymentDetails = async (
  gameId: string
): Promise<GamePaymentDetails> => {
  try {
    const response = await apiClient.get(
      buildApiUrl(`/games/${gameId}/payment-details`)
    );
    return response.data;
  } catch (error) {
    console.error(
      `Error getting game payment details for game ${gameId}:`,
      error
    );
    throw error;
  }
};

// Add new interface for payment intent response
export interface PaymentIntentResponse {
  clientSecret: string;
  ephemeralKey: string;
  customerId: string;
  publishableKey: string;
}

// Add new function to create payment intent
export const createGamePaymentIntent = async (
  gameId: string
): Promise<PaymentIntentResponse> => {
  try {
    const response = await apiClient.post(
      buildApiUrl(`/games/${gameId}/payment`)
    );
    return response.data;
  } catch (error) {
    console.error(`Error creating payment intent for game ${gameId}:`, error);
    throw error;
  }
};

// Add new function to update game
export const updateGame = async (gameId: string, updateData: UpdateGameDto) => {
  try {
    const response = await apiClient.patch(
      buildApiUrl(`/games/${gameId}`),
      updateData
    );
    return response.data;
  } catch (error) {
    console.error(`Error updating game ${gameId}:`, error);
    throw error;
  }
};

export const completeGame = async (gameId: string) => {
  try {
    const response = await apiClient.patch(
      buildApiUrl(`/games/${gameId}/complete`)
    );
    return response.data;
  } catch (error) {
    console.error(`Error completing game ${gameId}:`, error);
    throw error;
  }
};
