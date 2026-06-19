import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { colors, spacing, typography } from "@/constants/theme";
import {
  getUserConversations,
  ConversationListItem,
} from "@/api/conversations";
import { useProfileStore } from "@/stores/profileStore";
import { Ionicons } from "@expo/vector-icons";

export default function ChatsPage() {
  const [conversations, setConversations] = useState<ConversationListItem[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { profile } = useProfileStore();

  const fetchConversations = useCallback(
    async (isRefresh = false) => {
      if (!profile?.id) {
        if (!isRefresh) setIsLoading(false);
        if (isRefresh) setIsRefreshing(false);
        return;
      }

      if (!isRefresh) setIsLoading(true);
      if (isRefresh) setIsRefreshing(true);
      setError(null);

      try {
        const fetchedConversations = await getUserConversations(profile.id);
        setConversations(fetchedConversations || []);
      } catch (err: any) {
        console.error("Error fetching conversations:", err);
        setError("Failed to load conversations. " + (err.message || ""));
        if (!isRefresh) {
          Alert.alert(
            "Error",
            "Could not load conversations. Please try again."
          );
        }
      } finally {
        if (!isRefresh) setIsLoading(false);
        if (isRefresh) setIsRefreshing(false);
      }
    },
    [profile?.id]
  );

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const onRefresh = useCallback(() => {
    fetchConversations(true);
  }, [fetchConversations]);

  const getConversationTitle = (conversation: ConversationListItem): string => {
    if (conversation.name) {
      return conversation.name;
    }

    if (conversation.type === "GAME") {
      // Use the formatted_title provided by the backend
      return conversation.formatted_title || "Round Chat";
    }

    if (conversation.type === "DIRECT") {
      // Find the other participant (not the current user)
      const otherParticipant = conversation.participants.find(
        (p) => p.user_id !== profile?.id
      );

      if (otherParticipant?.user?.profile) {
        const { first_name, last_name } = otherParticipant.user.profile;
        return `${first_name || ""} ${last_name || ""}`.trim() || "Chat";
      }
    }

    return "Chat";
  };

  const getConversationAvatar = (
    conversation: ConversationListItem
  ): string | null => {
    if (conversation.type === "DIRECT") {
      // Find the other participant (not the current user)
      const otherParticipant = conversation.participants.find(
        (p) => p.user_id !== profile?.id
      );
      return otherParticipant?.user?.profile?.photo || null;
    }

    // For game chats, could return a game-specific icon or group avatar
    return null;
  };

  const getConversationInitials = (
    conversation: ConversationListItem
  ): string => {
    if (conversation.type === "DIRECT") {
      // Find the other participant (not the current user)
      const otherParticipant = conversation.participants.find(
        (p) => p.user_id !== profile?.id
      );

      if (otherParticipant?.user?.profile) {
        const { first_name, last_name } = otherParticipant.user.profile;
        const firstInitial = first_name?.charAt(0)?.toUpperCase() || "";
        const lastInitial = last_name?.charAt(0)?.toUpperCase() || "";
        return `${firstInitial}${lastInitial}`.trim() || "?";
      }
    }

    if (conversation.type === "GAME") {
      return "R"; // Game icon fallback
    }

    // Fallback to first character of title
    const title = getConversationTitle(conversation);
    return title.charAt(0).toUpperCase() || "?";
  };

  const getConversationSubtitle = (
    conversation: ConversationListItem
  ): string => {
    if (conversation.type === "GAME") {
      // For game chats, show generic subtitle since we don't have game details
      return "Round conversation";
    }

    // Get the last message from the messages array
    const lastMessage =
      conversation.messages && conversation.messages.length > 0
        ? conversation.messages[conversation.messages.length - 1]
        : null;

    if (lastMessage) {
      const isMyMessage = lastMessage.user_id === profile?.id;
      const senderName = isMyMessage
        ? "You"
        : lastMessage.user?.profile?.first_name || "Someone";

      return `${senderName}: ${lastMessage.content}`;
    }

    return "No messages yet";
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) {
      // Today - show time
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (diffInDays === 1) {
      // Yesterday
      return "Yesterday";
    } else if (diffInDays < 7) {
      // This week - show day
      return date.toLocaleDateString([], { weekday: "short" });
    } else {
      // Older - show date
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  };

  const handleConversationPress = (conversation: ConversationListItem) => {
    router.push(`chat/${conversation.id}` as any);
  };

  const renderConversationItem = ({ item }: { item: ConversationListItem }) => {
    const title = getConversationTitle(item);
    const subtitle = getConversationSubtitle(item);
    const avatarUri = getConversationAvatar(item);

    // Get timestamp from last message or conversation creation
    const lastMessage =
      item.messages && item.messages.length > 0
        ? item.messages[item.messages.length - 1]
        : null;
    const timestamp = lastMessage
      ? formatTimestamp(lastMessage.created_at)
      : formatTimestamp(item.created_at);

    const hasUnread = item.unread_count && item.unread_count > 0;

    return (
      <TouchableOpacity
        style={styles.conversationItem}
        onPress={() => handleConversationPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              {item.type === "GAME" ? (
                <Ionicons
                  name="golf-outline"
                  size={24}
                  color={colors.text.primary}
                />
              ) : (
                <Text style={styles.avatarPlaceholderText}>
                  {getConversationInitials(item)}
                </Text>
              )}
            </View>
          )}
          {hasUnread && <View style={styles.unreadIndicator} />}
        </View>

        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text
              style={[
                styles.conversationTitle,
                hasUnread ? styles.unreadTitle : null,
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>
            <Text style={styles.timestamp}>{timestamp}</Text>
          </View>

          <View style={styles.conversationSubtitleContainer}>
            <Text
              style={[
                styles.conversationSubtitle,
                hasUnread ? styles.unreadSubtitle : null,
              ]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
            {hasUnread && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {item.unread_count! > 99 ? "99+" : item.unread_count}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons
        name="chatbubbles-outline"
        size={64}
        color={colors.text.secondary}
      />
      <Text style={styles.emptyTitle}>No conversations yet</Text>
      <Text style={styles.emptySubtitle}>
        Start chatting with other players or join a round to see your
        conversations here.
      </Text>
    </View>
  );

  if (isLoading && !isRefreshing) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.text.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={conversations}
        renderItem={renderConversationItem}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          conversations.length === 0 && styles.emptyListContent,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.text.primary}
            colors={[colors.text.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyState}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.black,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.surface,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.surface,
  },
  headerTitle: {
    fontSize: typography.fontSizes.xxxl,
    fontFamily: typography.fontFamily.light,
    color: colors.text.primary,
    letterSpacing: -1.5,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingTop: spacing.sm,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  conversationItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.neutral.black,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.surface,
  },
  avatarContainer: {
    position: "relative",
    marginRight: spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.neutral.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarPlaceholderText: {
    fontSize: typography.fontSizes.lg,
    fontFamily: typography.fontFamily.semibold,
    color: colors.text.primary,
  },
  unreadIndicator: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary.orange,
    borderWidth: 2,
    borderColor: colors.neutral.black,
  },
  conversationContent: {
    flex: 1,
    justifyContent: "center",
  },
  conversationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  conversationTitle: {
    fontSize: typography.fontSizes.lg,
    fontFamily: typography.fontFamily.regular,
    color: colors.text.primary,
    flex: 1,
    marginRight: spacing.sm,
  },
  unreadTitle: {
    fontFamily: typography.fontFamily.semibold,
  },
  timestamp: {
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.text.secondary,
  },
  conversationSubtitleContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  conversationSubtitle: {
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
    color: colors.text.secondary,
    flex: 1,
    marginRight: spacing.sm,
  },
  unreadSubtitle: {
    color: colors.text.primary,
    fontFamily: typography.fontFamily.medium,
  },
  unreadBadge: {
    backgroundColor: colors.primary.orange,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xs,
  },
  unreadBadgeText: {
    fontSize: typography.fontSizes.xs,
    fontFamily: typography.fontFamily.semibold,
    color: colors.neutral.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.fontSizes.xl,
    fontFamily: typography.fontFamily.semibold,
    color: colors.text.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: 22,
  },
});
