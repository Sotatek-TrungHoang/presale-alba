import React from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { colors } from "@/constants/theme";
import { useNotificationContext } from "@/providers/NotificationProvider";

const getNotificationIcon = (type: string) => {
  switch (type) {
    case "GAME":
    case "game":
      return "golf-outline";
    case "CHAT":
    case "chat":
      return "chatbubble-ellipses-outline";
    case "FOLLOW":
    case "follow":
      return "person-add-outline";
    case "GENERAL":
    case "general":
    default:
      return "notifications-outline";
  }
};

const getNotificationColor = (type: string) => {
  switch (type) {
    case "GAME":
    case "game":
      return "#4CAF50";
    case "CHAT":
    case "chat":
      return "#2196F3";
    case "FOLLOW":
    case "follow":
      return "#FF9800";
    case "GENERAL":
    case "general":
    default:
      return colors.text.primary;
  }
};

const formatTimeAgo = (date: Date) => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
};

export default function NotificationsScreen() {
  const {
    notifications,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications,
  } = useNotificationContext();

  const handleNotificationPress = async (notification: any) => {
    try {
      // Mark as read first
      await markAsRead(notification.id);

      // Navigate based on notification type and data
      const data = notification.data;

      if (notification.type === "GAME" && data?.gameId) {
        // Navigate to game details
        router.push(`/(app)/round/${data.gameId}`);
      } else if (notification.type === "CHAT" && data?.conversationId) {
        // Navigate to chat conversation
        router.push(`/(app)/chat/${data.conversationId}`);
      } else if (notification.type === "CHAT" && data?.chatId) {
        // Legacy support for chatId
        router.push(`/(app)/chat/${data.chatId}`);
      } else if (notification.type === "FOLLOW" && data?.userId) {
        // Navigate to user profile
        router.push(`/(app)/user/${data.userId}`);
      } else if (
        data?.action === "payment_failed" ||
        data?.action === "refund_processed"
      ) {
        // Navigate to my games for payment-related notifications
        router.push("/(app)/(tabs)/myRounds" as any);
      } else if (
        data?.action === "payout_success" ||
        data?.action === "payout_failed" ||
        data?.action === "account_verified" ||
        data?.action === "account_issue"
      ) {
        // Navigate to stripe onboarding for account-related notifications
        router.push("/(app)/stripe-onboarding");
      } else if (
        data?.action === "complaint_resolved" ||
        data?.action === "complaint_rejected"
      ) {
        // Navigate to the specific game if available, otherwise to my games
        if (data?.gameId) {
          router.push(`/(app)/round/${data.gameId}`);
        } else {
          router.push("/(app)/(tabs)/myRounds" as any);
        }
      } else if (notification.type === "GAME") {
        // Default game notification - go to my games
        router.push("/(app)/(tabs)/myRounds" as any);
      } else if (notification.type === "CHAT") {
        // Default chat notification - go to chats
        router.push("/(app)/(tabs)/chats" as any);
      }
      // For GENERAL notifications or notifications without specific navigation,
      // we don't navigate anywhere - just mark as read
    } catch (error) {
      console.error("Failed to handle notification press:", error);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markAsRead(notificationId);
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  const handleDeleteNotification = (notificationId: string) => {
    Alert.alert(
      "Delete Notification",
      "Are you sure you want to delete this notification?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteNotification(notificationId);
            } catch (error) {
              console.error("Failed to delete notification:", error);
            }
          },
        },
      ]
    );
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const renderNotificationItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[styles.notificationItem, !item.read && styles.unreadNotification]}
      onPress={() => handleNotificationPress(item)}
      onLongPress={() => handleDeleteNotification(item.id)}
    >
      <View style={styles.notificationContent}>
        <View style={styles.notificationHeader}>
          <Ionicons
            name={getNotificationIcon(item.type)}
            size={20}
            color={getNotificationColor(item.type)}
            style={styles.notificationIcon}
          />
          <View style={styles.notificationTextContainer}>
            <Text style={styles.notificationTitle}>{item.title}</Text>
            <Text style={styles.notificationBody}>{item.body}</Text>
            <Text style={styles.notificationTime}>
              {formatTimeAgo(item.timestamp)}
            </Text>
          </View>
        </View>
        {!item.read && <View style={styles.unreadIndicator} />}
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons
        name="notifications-off-outline"
        size={64}
        color={colors.text.secondary}
      />
      <Text style={styles.emptyStateTitle}>No notifications yet</Text>
      <Text style={styles.emptyStateSubtitle}>
        You'll see notifications about rounds, messages, and other activities
        here
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        {notifications.length > 0 && (
          <TouchableOpacity onPress={handleMarkAllAsRead}>
            <Text style={styles.markAllRead}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        renderItem={renderNotificationItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.notificationsList}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refreshNotifications}
            tintColor={colors.text.primary}
          />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.black,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.surface,
  },
  title: {
    color: colors.text.primary,
    fontSize: 28,
    fontWeight: "600",
  },
  markAllRead: {
    color: colors.primary.yellow,
    fontSize: 16,
    fontWeight: "500",
  },
  notificationsList: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  notificationItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.surface,
  },
  unreadNotification: {
    backgroundColor: colors.neutral.surface + "20",
  },
  notificationContent: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  notificationHeader: {
    flexDirection: "row",
    flex: 1,
  },
  notificationIcon: {
    marginRight: 16,
    marginTop: 2,
  },
  notificationTextContainer: {
    flex: 1,
  },
  notificationTitle: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  notificationBody: {
    color: colors.text.secondary,
    fontSize: 14,
    fontWeight: "400",
    marginBottom: 4,
    lineHeight: 20,
  },
  notificationTime: {
    color: colors.text.disabled,
    fontSize: 12,
    fontWeight: "400",
  },
  unreadIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary.yellow,
    marginLeft: 8,
    marginTop: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    paddingTop: 100,
  },
  emptyStateTitle: {
    color: colors.text.primary,
    fontSize: 20,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    color: colors.text.secondary,
    fontSize: 16,
    fontWeight: "400",
    textAlign: "center",
    lineHeight: 24,
  },
});
