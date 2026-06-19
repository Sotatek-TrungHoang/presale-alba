import axios from "axios";
import { ComplaintType } from "@/types/complaints";
import { DEFAULT_CONFIG, buildApiUrl } from "./config";
// Firebase auth token helper
const getFirebaseAuthToken = async (
  forceRefresh: boolean = false
): Promise<string> => {
  try {
    const { getAuth } = await import("firebase/auth");
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      throw new Error("No authenticated user found");
    }

    const idToken = await user.getIdToken(forceRefresh);
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

export interface Complaint {
  id: string;
  game_id: string;
  complainant_id: string;
  type: ComplaintType;
  description: string;
  status: "PENDING" | "IN_REVIEW" | "RESOLVED" | "REFUNDED" | "REJECTED";
  resolved_by?: string;
  resolution?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateComplaintDto {
  type: ComplaintType;
  description: string;
}

export const getGameComplaints = async (
  gameId: string
): Promise<Complaint[]> => {
  try {
    const response = await apiClient.get(
      buildApiUrl(`/complaints/games/${gameId}`)
    );
    return response.data;
  } catch (error) {
    console.error(`Error getting complaints for game ${gameId}:`, error);
    throw error;
  }
};

export const createComplaint = async (
  gameId: string,
  complaintData: CreateComplaintDto
): Promise<Complaint> => {
  try {
    const response = await apiClient.post(
      buildApiUrl(`/complaints/games/${gameId}`),
      complaintData
    );
    return response.data;
  } catch (error) {
    console.error(`Error creating complaint for game ${gameId}:`, error);
    throw error;
  }
};
