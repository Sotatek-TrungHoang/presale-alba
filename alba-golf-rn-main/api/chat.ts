import axios from "axios";
import { buildApiUrl, DEFAULT_CONFIG } from "./config"; // Assuming you have this from api/games.ts setup
import { getIdToken } from "firebase/auth"; // Reusing Firebase auth for token
import { auth } from "@/firebase.config"; // Your Firebase auth instance

// Define interfaces for chat messages based on backend structure
export interface ChatMessageUserProfile {
  first_name?: string | null;
  last_name?: string | null; // Added for completeness
  photo?: string | null;
}

export interface ChatMessageUser {
  id: string; // This is the actual user_id
  profile: ChatMessageUserProfile | null;
}

export interface ChatMessage {
  id: string; // Message ID
  content: string;
  created_at: string; // ISO date string
  user_id: string; // ID of the user who sent the message
  user: ChatMessageUser; // Nested user details
  conversation_id: string;
  // Add any other fields your message object might have from the backend
  // e.g., type, read_at, attachments etc.
}

// Re-use or adapt the apiClient setup from api/games.ts
// This ensures requests are authenticated
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
      // Don't throw here if some chat endpoints might be public,
      // but for messages, it's likely private.
      console.error(
        "Chat API Interceptor: Failed to get auth token for request:",
        error
      );
      // Rethrow if all chat endpoints require auth
      // throw new Error("Failed to attach auth token for chat API");
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const getMessagesByConversationId = async (
  conversationId: string
): Promise<ChatMessage[]> => {
  if (!conversationId) {
    console.error("getMessagesByConversationId: conversationId is required.");
    throw new Error("Conversation ID is required.");
  }
  try {
    const response = await apiClient.get(
      buildApiUrl(`/conversations/${conversationId}/messages`)
    );
    return response.data as ChatMessage[];
  } catch (error) {
    console.error(
      `Error fetching messages for conversation ${conversationId}:`,
      error
    );
    throw error; // Rethrow to be handled by the calling component
  }
};

// We might add a function to send a message via HTTP API as a fallback or for other purposes,
// but primary sending will be via WebSockets.
// export const createMessageViaHttp = async (dto: CreateMessageDto) => { ... }
