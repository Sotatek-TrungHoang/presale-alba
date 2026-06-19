import { auth } from "@/firebase.config";
import axios from "axios";
import { getIdToken } from "firebase/auth";
import { buildApiUrl, DEFAULT_CONFIG } from "./config";

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

export const followUser = async (userId: string) => {
  try {
    const response = await apiClient.post(buildApiUrl("relationships/follow"), {
      followingId: userId,
    });
    return response.data;
  } catch (error) {
    console.error("Error following user:", error);
    throw new Error("Failed to follow user");
  }
};

export const unfollowUser = async (userId: string) => {
  try {
    const response = await apiClient.delete(
      buildApiUrl("relationships/unfollow"),
      {
        data: {
          followingId: userId,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error unfollowing user:", error);
    throw new Error("Failed to unfollow user");
  }
};

export const checkIfFollowing = async (userId: string) => {
  try {
    const response = await apiClient.get(
      buildApiUrl(`relationships/follow-status/${userId}`)
    );
    return response.data;
  } catch (error) {
    throw new Error("Failed to check follow status");
  }
};
