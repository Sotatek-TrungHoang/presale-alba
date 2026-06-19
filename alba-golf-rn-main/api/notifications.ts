import { buildApiUrl, DEFAULT_CONFIG } from "./config";
import axios from "axios";
import { auth } from "@/firebase.config";
import { getIdToken } from "firebase/auth";

const getFirebaseAuthToken = async (
  forceRefresh: boolean = false
): Promise<string> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Authentication required. Please log in.");
  }
  try {
    const idToken = await getIdToken(currentUser, forceRefresh);
    return idToken;
  } catch (error) {
    console.error("Error getting ID token:", error);
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

export interface RegisterTokenDto {
  token: string;
  platform: string;
}

export interface NotificationDto {
  id: string;
  title: string;
  body: string;
  data?: any;
  timestamp: string;
  read: boolean;
  type: "GAME" | "CHAT" | "FOLLOW" | "GENERAL";
}

export interface CreateNotificationDto {
  title: string;
  body: string;
  data?: any;
  type: "GAME" | "CHAT" | "FOLLOW" | "GENERAL";
  userId?: string;
}

export interface NotificationSettingsDto {
  gameNotifications?: boolean;
  chatNotifications?: boolean;
  followNotifications?: boolean;
  generalNotifications?: boolean;
}

// ===================== CORE NOTIFICATION ENDPOINTS =====================

/**
 * Register push token with backend
 */
export const registerPushToken = async (data: RegisterTokenDto) => {
  try {
    const response = await apiClient.post(
      buildApiUrl("notifications/register"),
      data
    );
    return response.data;
  } catch (error) {
    console.error("Failed to register push token:", error);
    throw error;
  }
};

/**
 * Get user's notifications
 */
export const getNotifications = async (): Promise<NotificationDto[]> => {
  try {
    const response = await apiClient.get(buildApiUrl("notifications"));
    return response.data;
  } catch (error) {
    console.error("Failed to get notifications:", error);
    throw error;
  }
};

/**
 * Mark notification as read
 */
export const markNotificationAsRead = async (notificationId: string) => {
  try {
    const response = await apiClient.put(
      buildApiUrl(`notifications/${notificationId}/read`)
    );
    return response.data;
  } catch (error) {
    console.error("Failed to mark notification as read:", error);
    throw error;
  }
};

/**
 * Mark all notifications as read
 */
export const markAllNotificationsAsRead = async () => {
  try {
    const response = await apiClient.put(buildApiUrl("notifications/read-all"));
    return response.data;
  } catch (error) {
    console.error("Failed to mark all notifications as read:", error);
    throw error;
  }
};

/**
 * Delete notification
 */
export const deleteNotification = async (notificationId: string) => {
  try {
    const response = await apiClient.delete(
      buildApiUrl(`notifications/${notificationId}`)
    );
    return response.data;
  } catch (error) {
    console.error("Failed to delete notification:", error);
    throw error;
  }
};

/**
 * Get notification settings
 */
export const getNotificationSettings =
  async (): Promise<NotificationSettingsDto> => {
    try {
      const response = await apiClient.get(
        buildApiUrl("notifications/settings")
      );
      return response.data;
    } catch (error) {
      console.error("Failed to get notification settings:", error);
      throw error;
    }
  };

/**
 * Update notification settings
 */
export const updateNotificationSettings = async (
  settings: NotificationSettingsDto
): Promise<NotificationSettingsDto> => {
  try {
    const response = await apiClient.put(
      buildApiUrl("notifications/settings"),
      settings
    );
    return response.data;
  } catch (error) {
    console.error("Failed to update notification settings:", error);
    throw error;
  }
};

// ===================== ADMIN FUNCTIONS (for testing/admin use) =====================

/**
 * Send notification to specific user (admin function)
 */
export const sendNotificationToUser = async (
  userId: string,
  data: CreateNotificationDto
) => {
  try {
    const response = await apiClient.post(
      buildApiUrl(`notifications/send/${userId}`),
      data
    );
    return response.data;
  } catch (error) {
    console.error("Failed to send notification to user:", error);
    throw error;
  }
};

/**
 * Send notification to all users (admin function)
 */
export const sendNotificationToAll = async (data: CreateNotificationDto) => {
  try {
    const response = await apiClient.post(
      buildApiUrl("notifications/send-all"),
      data
    );
    return response.data;
  } catch (error) {
    console.error("Failed to send notification to all users:", error);
    throw error;
  }
};

// ===================== NOTIFICATION TEMPLATE HELPERS =====================

/**
 * Helper functions to create properly formatted notifications for common scenarios
 * These match the backend service methods
 */

export const createGameInviteNotification = (
  gameId: string,
  inviterName: string
): CreateNotificationDto => ({
  title: "New Game Invitation",
  body: `${inviterName} invited you to join a game`,
  data: {
    gameId,
    action: "invite",
  },
  type: "GAME",
});

export const createGameReminderNotification = (
  gameId: string,
  gameTime: string
): CreateNotificationDto => ({
  title: "Game Reminder",
  body: `Your game starts in 30 minutes at ${gameTime}`,
  data: {
    gameId,
    action: "reminder",
  },
  type: "GAME",
});

export const createNewMessageNotification = (
  chatId: string,
  senderName: string,
  messagePreview: string
): CreateNotificationDto => ({
  title: `Message from ${senderName}`,
  body:
    messagePreview.length > 50
      ? `${messagePreview.substring(0, 50)}...`
      : messagePreview,
  data: {
    chatId,
    action: "new_message",
  },
  type: "CHAT",
});

export const createNewFollowerNotification = (
  followerName: string
): CreateNotificationDto => ({
  title: "New Follower",
  body: `${followerName} started following you`,
  data: {
    action: "new_follower",
  },
  type: "FOLLOW",
});

export const createWelcomeNotification = (): CreateNotificationDto => ({
  title: "Welcome to Alba!",
  body: "Thanks for joining. Start exploring golf courses and connecting with other players.",
  data: {
    action: "welcome",
  },
  type: "GENERAL",
});

// ===================== TESTING FUNCTIONS =====================

/**
 * Test functions for development - these call your backend directly
 */
export const testNotifications = {
  // Test game notifications
  async sendGameInvite(gameId: string, inviterName: string) {
    const notification = createGameInviteNotification(gameId, inviterName);
    return await sendNotificationToUser(
      auth.currentUser?.uid || "",
      notification
    );
  },

  async sendGameReminder(gameId: string, gameTime: string) {
    const notification = createGameReminderNotification(gameId, gameTime);
    return await sendNotificationToUser(
      auth.currentUser?.uid || "",
      notification
    );
  },

  // Test chat notifications
  async sendNewMessage(chatId: string, senderName: string, message: string) {
    const notification = createNewMessageNotification(
      chatId,
      senderName,
      message
    );
    return await sendNotificationToUser(
      auth.currentUser?.uid || "",
      notification
    );
  },

  // Test follow notifications
  async sendNewFollower(followerName: string) {
    const notification = createNewFollowerNotification(followerName);
    return await sendNotificationToUser(
      auth.currentUser?.uid || "",
      notification
    );
  },

  // Test general notifications
  async sendWelcome() {
    const notification = createWelcomeNotification();
    return await sendNotificationToUser(
      auth.currentUser?.uid || "",
      notification
    );
  },

  // Test broadcast
  async sendToAll(
    title: string,
    body: string,
    type: "GAME" | "CHAT" | "FOLLOW" | "GENERAL" = "GENERAL"
  ) {
    const notification: CreateNotificationDto = {
      title,
      body,
      type,
      data: { action: "test_broadcast" },
    };
    return await sendNotificationToAll(notification);
  },
};
