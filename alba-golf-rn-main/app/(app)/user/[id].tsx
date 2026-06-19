import React, { useLayoutEffect, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
  Pressable,
} from "react-native";
import { useLocalSearchParams, useNavigation, router } from "expo-router";
import { HandicapRange } from "@/api/user";
import { followUser, unfollowUser } from "@/api/follow";
import { colors, typography, spacing } from "@/constants/theme";
import { formatGeneralDisplayValue } from "@/utils/formatters";
import { useLocation } from "@/providers/LocationProvider";
import { getOrCreateConversation } from "@/api/conversations";
import { CircleButton } from "@/components/ui";
import { useUserProfile } from "@/hooks/useUserProfile";
import { UserProfileHeader } from "@/components/user/UserProfileHeader";
import { UserFollowButton } from "@/components/user/UserFollowButton";
import { UserTabNavigation } from "@/components/user/UserTabNavigation";
import { UserAboutTab } from "@/components/user/UserAboutTab";
import { UserAvailabilityTab } from "@/components/user/UserAvailabilityTab";
import { useProfileStore } from "@/stores/profileStore";
import { Ionicons } from "@expo/vector-icons";
import { createReport } from "@/api/reports";
import { blockUser, unblockUser, isUserBlocked } from "@/api/blocks";

type TabType = "about" | "availability";

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams();
  const navigation = useNavigation();
  const { currentLocation } = useLocation();
  const { profile: currentUser } = useProfileStore();
  const [activeTab, setActiveTab] = useState<TabType>("about");
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isCheckingBlock, setIsCheckingBlock] = useState(true);

  const {
    user,
    isLoading,
    distance,
    isFollowing,
    setIsFollowing,
    setUser,
    error,
  } = useUserProfile({
    id: id as string,
    currentLocation,
    currentUserId: currentUser?.id,
  });

  // Check if the viewed user is blocked by the current user
  useEffect(() => {
    const checkBlock = async () => {
      if (!currentUser || !id || currentUser.id === id) {
        setIsBlocked(false);
        setIsCheckingBlock(false);
        return;
      }
      try {
        const blocked = await isUserBlocked(id as string);
        setIsBlocked(blocked);
      } catch (e) {
        setIsBlocked(false);
      } finally {
        setIsCheckingBlock(false);
      }
    };
    checkBlock();
  }, [currentUser?.id, id]);

  const handleFollowToggle = async () => {
    if (!currentUser || currentUser.uid === id) return;
    setIsFollowLoading(true);
    try {
      if (isFollowing) {
        await unfollowUser(id as string);
        setIsFollowing(false);
        if (user?.stats) {
          const newFollowersCount = user.stats.followers - 1;

          setUser({
            ...user,
            stats: {
              ...user.stats,
              followers: newFollowersCount,
            },
          });
        }
      } else {
        await followUser(id as string);
        setIsFollowing(true);
        if (user?.stats) {
          const newFollowersCount = user.stats.followers + 1;
          setUser({
            ...user,
            stats: {
              ...user.stats,
              followers: newFollowersCount,
            },
          });
        }
      }
    } catch (error) {
      console.error("Error toggling follow:", error);
      Alert.alert("Error", "Failed to update follow status. Please try again.");
    } finally {
      setIsFollowLoading(false);
    }
  };

  const handleChatPress = async () => {
    if (!currentUser || currentUser.uid === id || !id) {
      Alert.alert("Error", "Cannot start chat with this user.");
      return;
    }
    if (isBlocked) {
      Alert.alert("Unavailable", "You have blocked this user.");
      return;
    }
    try {
      const response = await getOrCreateConversation(id as string);
      const conversation = response.conversation;
      const conversationId = conversation?.id;
      if (!conversationId) {
        Alert.alert("Error", "Failed to create conversation - no ID returned.");
        return;
      }
      router.push(`/(app)/chat/${conversationId}` as any);
    } catch (error) {
      console.error("Error creating conversation:", error);
      Alert.alert("Error", "Failed to start chat. Please try again.");
    }
  };

  const promptReport = () => {
    const targetUserId = id as string;
    Alert.alert(
      "Report User",
      "Tell us what’s wrong:",
      [
        {
          text: "Spam",
          onPress: async () => {
            try {
              await createReport({
                targetType: "USER",
                targetId: targetUserId,
                reason: "SPAM",
              });
              Alert.alert("Thanks", "Your report has been submitted.");
            } catch {
              Alert.alert("Error", "Could not submit report. Try again.");
            }
          },
        },
        {
          text: "Harassment",
          onPress: async () => {
            try {
              await createReport({
                targetType: "USER",
                targetId: targetUserId,
                reason: "HARASSMENT",
              });
              Alert.alert("Thanks", "Your report has been submitted.");
            } catch {
              Alert.alert("Error", "Could not submit report. Try again.");
            }
          },
        },
        {
          text: "Inappropriate",
          onPress: async () => {
            try {
              await createReport({
                targetType: "USER",
                targetId: targetUserId,
                reason: "INAPPROPRIATE",
              });
              Alert.alert("Thanks", "Your report has been submitted.");
            } catch {
              Alert.alert("Error", "Could not submit report. Try again.");
            }
          },
        },
        {
          text: "Other",
          onPress: async () => {
            try {
              await createReport({
                targetType: "USER",
                targetId: targetUserId,
                reason: "OTHER",
              });
              Alert.alert("Thanks", "Your report has been submitted.");
            } catch {
              Alert.alert("Error", "Could not submit report. Try again.");
            }
          },
        },
        { text: "Cancel", style: "cancel" },
      ],
      { cancelable: true }
    );
  };

  const toggleBlockUser = () => {
    if (!id) return;
    if (isBlocked) {
      Alert.alert(
        "Unblock user?",
        "You will see this user again and they can interact with you based on your settings.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Unblock",
            style: "destructive",
            onPress: async () => {
              try {
                await unblockUser(id as string);
                setIsBlocked(false);
                Alert.alert("Unblocked", "This user has been unblocked.");
              } catch {
                Alert.alert("Error", "Could not unblock user. Try again.");
              }
            },
          },
        ]
      );
    } else {
      Alert.alert(
        "Block user?",
        "You won’t see this user, and they won’t be able to follow or message you.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Block",
            style: "destructive",
            onPress: async () => {
              try {
                await blockUser(id as string);
                setIsBlocked(true);
                Alert.alert("Blocked", "This user has been blocked.");
              } catch {
                Alert.alert("Error", "Could not block user. Try again.");
              }
            },
          },
        ]
      );
    }
  };

  const handleHeaderMenuPress = () => {
    if (!currentUser || currentUser.uid === id) {
      Alert.alert("Options", "No actions available on your own profile.");
      return;
    }
    Alert.alert("Options", undefined, [
      { text: "Report User", onPress: promptReport },
      {
        text: isBlocked ? "Unblock User" : "Block User",
        onPress: toggleBlockUser,
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight:
        !currentUser || currentUser.uid === id
          ? undefined
          : () => (
              <Pressable onPress={handleHeaderMenuPress} style={{ padding: 8 }}>
                <Ionicons
                  name="ellipsis-horizontal"
                  size={24}
                  color={colors.text.primary}
                />
              </Pressable>
            ),
    });
  }, [navigation, currentUser?.uid, id, isBlocked]);

  if (isLoading || isCheckingBlock) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="small" color={colors.text.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.errorText}>User not found</Text>
      </View>
    );
  }

  const profile = user.profile;
  const onboarding = user.onboarding;
  const stats = user.stats;
  const playerName = `${profile?.first_name || "Golfer"} ${
    profile?.last_name || ""
  }`.trim();
  const photoUri = profile?.photo;
  const isOwnProfile = currentUser && currentUser.id === id;

  const handicapText =
    onboarding?.handicap_range &&
    onboarding?.handicap_range !== HandicapRange.DONT_KNOW
      ? `${formatGeneralDisplayValue(onboarding.handicap_range as string)}`
      : "Handicap not set";

  const displayHandicap =
    handicapText !== "Handicap not set" &&
    !handicapText.toLowerCase().includes("handicapper")
      ? `${handicapText}-Handicapper (${handicapText.split(" ")[0]})`
      : handicapText;

  let displayDistance = "";
  if (typeof distance === "number") {
    if (distance < 1) {
      displayDistance = "<1km away";
    } else {
      displayDistance = `${Math.round(distance)}km away`;
    }
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
      >
        <UserProfileHeader
          playerName={playerName}
          photoUri={photoUri}
          firstName={profile?.first_name}
          lastName={profile?.last_name}
          displayHandicap={displayHandicap}
          displayDistance={displayDistance}
          stats={stats}
        >
          {!isOwnProfile && currentUser && !isBlocked && (
            <UserFollowButton
              isFollowing={isFollowing}
              isLoading={isFollowLoading}
              onPress={handleFollowToggle}
            />
          )}
        </UserProfileHeader>
        <UserTabNavigation activeTab={activeTab} setActiveTab={setActiveTab} />
        <View style={styles.tabContent}>
          {activeTab === "about" ? (
            <UserAboutTab onboarding={onboarding} />
          ) : (
            <UserAvailabilityTab onboarding={onboarding} />
          )}
        </View>
      </ScrollView>
      {/* Floating Chat Button */}
      {!isOwnProfile && currentUser && !isBlocked && (
        <View style={styles.floatingChatButton}>
          <CircleButton
            onPress={handleChatPress}
            iconFamily="Ionicons"
            iconName="chatbubble-outline"
          />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.black,
  },
  contentContainer: {
    paddingBottom: spacing.xxl,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.neutral.black,
  },
  errorText: {
    color: colors.semantic.error,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
  },
  tabContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  floatingChatButton: {
    position: "absolute",
    right: spacing.xl,
    bottom: spacing.xxl + spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary.orange,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: colors.neutral.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
