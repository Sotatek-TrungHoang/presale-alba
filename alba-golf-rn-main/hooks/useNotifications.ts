import { useState, useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { useAuth } from "@/providers/Auth";
import { router } from "expo-router";
import {
  registerPushToken,
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification as deleteNotificationApi,
  NotificationDto,
} from "@/api/notifications";
import { useProfileStore } from "@/stores/profileStore";

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationData {
  id: string;
  title: string;
  body: string;
  data?: any;
  timestamp: Date;
  read: boolean;
  type: "GAME" | "CHAT" | "FOLLOW" | "GENERAL";
}

export function useNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] =
    useState<Notifications.Notification | null>(null);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { profile, loadingProfile } = useProfileStore();

  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  // Mount-only: register for push notifications & attach listeners
  useEffect(() => {
    registerForPushNotificationsAsync().then((token) => {
      setExpoPushToken(token);
    });

    // Listen for notifications received while app is in foreground
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        setNotification(notification);
        // Add to local notifications list
        addNotificationToList(notification);
      });

    // Listen for user tapping on notification
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        console.log("Notification tapped:", response);
        handleNotificationTap(response);
      });

    return () => {
      // Expo SDK 49+: subscription objects have a `.remove()` method.
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []); // runs once

  // ----- One-time sync once user + profile + token are ready -----
  const didInitialSync = useRef(false);

  useEffect(() => {
    if (!didInitialSync.current && user && profile && !loadingProfile) {
      if (expoPushToken) {
        sendTokenToBackend(expoPushToken);
      }
      loadNotifications();
      didInitialSync.current = true;
    }
  }, [user, profile, loadingProfile, expoPushToken]);

  const registerForPushNotificationsAsync = async (): Promise<
    string | null
  > => {
    let token: string | null = null;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      });

      // Create specialized channels to match backend
      await Notifications.setNotificationChannelAsync("round_updates", {
        name: "Round Updates",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#4CAF50",
        description: "Notifications about rounds, invitations, and bookings",
      });

      await Notifications.setNotificationChannelAsync("chat_messages", {
        name: "Chat Messages",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 100, 100, 100],
        lightColor: "#2196F3",
        description: "New messages from other players",
      });

      await Notifications.setNotificationChannelAsync("social_updates", {
        name: "Social Updates",
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 200, 200, 200],
        lightColor: "#FF9800",
        description: "Followers and social interactions",
      });

      await Notifications.setNotificationChannelAsync("general_updates", {
        name: "General Updates",
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 300, 300, 300],
        lightColor: "#9C27B0",
        description: "General app notifications and updates",
      });

      await Notifications.setNotificationChannelAsync("financial_updates", {
        name: "Financial Updates",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 400, 200, 400],
        lightColor: "#FF5722",
        description: "Payment, refund, and payout notifications",
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.log("Failed to get push token for push notification!");
        return null;
      }

      try {
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId:
            process.env.EXPO_PUBLIC_PROJECT_ID ||
            "98d855d4-43ae-4808-8abc-cef08fcb9e4b",
        });
        token = tokenData.data;
      } catch (error) {
        console.error("Error getting push token:", error);
        return null;
      }
    } else {
      console.log("Must use physical device for Push Notifications");
    }

    return token;
  };

  const sendTokenToBackend = async (token: string) => {
    try {
      await registerPushToken({
        token,
        platform: Platform.OS,
      });
      console.log("Push token sent to backend");
    } catch (error) {
      console.error("Failed to send token to backend:", error);
    }
  };

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const notificationsData: NotificationDto[] = await getNotifications();
      const formattedNotifications: NotificationData[] = notificationsData.map(
        (n) => ({
          id: n.id,
          title: n.title,
          body: n.body,
          data: n.data,
          timestamp: new Date(n.timestamp),
          read: n.read,
          type: n.type,
        })
      );
      setNotifications(formattedNotifications);
    } catch (error) {
      console.error("Failed to load notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const addNotificationToList = (notification: Notifications.Notification) => {
    const data = notification.request.content.data;

    // Ensure we have valid notification type
    const validTypes: Array<"GAME" | "CHAT" | "FOLLOW" | "GENERAL"> = [
      "GAME",
      "CHAT",
      "FOLLOW",
      "GENERAL",
    ];
    const notificationType = (
      validTypes.includes(data?.type as any) ? data.type : "GENERAL"
    ) as "GAME" | "CHAT" | "FOLLOW" | "GENERAL";

    const newNotification: NotificationData = {
      id: notification.request.identifier,
      title: notification.request.content.title || "",
      body: notification.request.content.body || "",
      data: notification.request.content.data,
      timestamp: new Date(),
      read: false,
      type: notificationType,
    };

    setNotifications((prev) => [newNotification, ...prev]);
  };

  const handleNotificationTap = (
    response: Notifications.NotificationResponse
  ) => {
    const data = response.notification.request.content.data;

    try {
      // Handle navigation based on notification type and action
      if (data?.type === "GAME" && data?.gameId) {
        // Navigate to game details
        console.log("Navigate to game:", data.gameId);
        router.push(`/(app)/round/${data.gameId}`);
      } else if (data?.type === "CHAT" && data?.conversationId) {
        // Navigate to chat conversation
        console.log("Navigate to conversation:", data.conversationId);
        router.push(`/(app)/chat/${data.conversationId}`);
      } else if (data?.type === "CHAT" && data?.chatId) {
        // Legacy support for chatId (redirect to conversationId format)
        console.log("Navigate to chat:", data.chatId);
        router.push(`/(app)/chat/${data.chatId}`);
      } else if (data?.type === "FOLLOW" && data?.userId) {
        // Navigate to user profile
        console.log("Navigate to user profile:", data.userId);
        router.push(`/(app)/user/${data.userId}`);
      } else if (
        data?.action === "payment_failed" ||
        data?.action === "refund_processed"
      ) {
        console.log("Navigate to payment history");
        // router.push("/(app)/(tabs)/myGames");
      } else if (
        data?.action === "payout_success" ||
        data?.action === "payout_failed"
      ) {
        // Navigate to stripe onboarding/account management
        console.log("Navigate to account management");
        // router.push("/(app)/stripe-onboarding");
      } else if (
        data?.action === "account_verified" ||
        data?.action === "account_issue"
      ) {
        // Navigate to stripe onboarding
        console.log("Navigate to stripe onboarding");
        router.push("/(app)/stripe-onboarding");
      } else if (
        data?.action === "complaint_resolved" ||
        data?.action === "complaint_rejected"
      ) {
        // Navigate to the specific game if gameId is available
        if (data?.gameId) {
          console.log("Navigate to game from complaint:", data.gameId);
          router.push(`/(app)/round/${data.gameId}`);
        } else {
          // Otherwise go to my games
          console.log("Navigate to my rounds");
          router.push("/(app)/(tabs)/myRounds" as any);
        }
      } else {
        // Default: navigate to notifications screen to show the notification
        console.log("Navigate to notifications screen");
        router.push("/(app)/notifications");
      }
    } catch (error) {
      console.error("Failed to navigate from notification:", error);
      // Fallback: navigate to notifications screen
      router.push("/(app)/notifications");
    }

    // Mark as read
    markAsRead(response.notification.request.identifier);
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await markNotificationAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      await deleteNotificationApi(notificationId);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    } catch (error) {
      console.error("Failed to delete notification:", error);
    }
  };

  const refreshNotifications = () => {
    loadNotifications();
  };

  return {
    expoPushToken,
    notification,
    notifications,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications,
  };
}
