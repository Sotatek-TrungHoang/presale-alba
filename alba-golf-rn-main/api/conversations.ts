import axios from "axios";
import { buildApiUrl, DEFAULT_CONFIG } from "./config";
import { getIdToken } from "firebase/auth";
import { auth } from "@/firebase.config";
import { ChatMessage } from "./chat";

// DTO for getting or creating a conversation
export interface GetOrCreateConversationDto {
  profileId: string;
}

// Response from get-or-create conversation endpoint
export interface ConversationResponse {
  conversation: {
    id: string;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
    type: string;
    name: string | null;
    game_id: string | null;
    group_id: string | null;
    participants: any[];
  };
}

// Interface for conversation list item
export interface ConversationListItem {
  id: string;
  type: string; // "DIRECT", "GAME", "GROUP"
  name: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  game_id: string | null;
  group_id: string | null;
  formatted_title?: string; // Backend-provided formatted title for game conversations
  messages: {
    id: string;
    content: string;
    created_at: string;
    user_id: string;
    user: {
      id: string;
      profile: {
        first_name?: string | null;
        last_name?: string | null;
        photo?: string | null;
      } | null;
    };
  }[];
  participants: {
    user_id: string;
    user: {
      id: string;
      profile: {
        first_name?: string | null;
        last_name?: string | null;
        photo?: string | null;
      } | null;
    };
  }[];
  unread_count?: number; // Optional: if backend provides unread count
}

// Setup authenticated API client
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
        "Conversations API Interceptor: Failed to get auth token for request:",
        error
      );
      throw new Error("Failed to attach auth token for conversations API");
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const getOrCreateConversation = async (
  profileId: string
): Promise<ConversationResponse> => {
  if (!profileId) {
    throw new Error("Profile ID is required.");
  }

  try {
    const response = await apiClient.post(
      buildApiUrl("conversations/get-or-create"),
      { profileId }
    );
    return response.data as ConversationResponse;
  } catch (error) {
    console.error(
      `Error getting or creating conversation with profile ${profileId}:`,
      error
    );
    throw error;
  }
};

export const getConversationMessages = async (
  conversationId: string
): Promise<ChatMessage[]> => {
  if (!conversationId) {
    throw new Error("Conversation ID is required.");
  }

  try {
    const response = await apiClient.get(
      buildApiUrl(`conversations/${conversationId}/messages`)
    );
    return response.data as ChatMessage[];
  } catch (error) {
    console.error(
      `Error fetching messages for conversation ${conversationId}:`,
      error
    );
    throw error;
  }
};

// Get all conversations for the current user
export const getUserConversations = async (
  userId: string
): Promise<ConversationListItem[]> => {
  if (!userId) {
    throw new Error("User ID is required.");
  }

  try {
    const response = await apiClient.get(
      buildApiUrl(`conversations/${userId}`)
    );
    return response.data as ConversationListItem[];
  } catch (error) {
    console.error(`Error fetching conversations for user ${userId}:`, error);
    throw error;
  }
};
