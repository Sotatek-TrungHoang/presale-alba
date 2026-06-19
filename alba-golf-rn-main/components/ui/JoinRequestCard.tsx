import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, spacing, typography } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { formatGeneralDisplayValue } from "@/utils/formatters"; // Changed import

// Mirror relevant parts of GamePlayer from [id].tsx
interface PlayerProfile {
  first_name?: string | null;
  last_name?: string | null;
  photo?: string | null;
  // No longer need handicap here, will use onboarding.handicap_range
}

interface UserOnboardingData {
  handicap_range: string;
}

interface UserWithProfile {
  id: string;
  profile: PlayerProfile | null;
  onboarding: UserOnboardingData | null;
}

export interface JoinRequestPlayer {
  user_id: string;
  user: UserWithProfile;
}

interface JoinRequestCardProps {
  player: JoinRequestPlayer;
  onAccept: (playerId: string) => void;
  onDecline: (playerId: string) => void;
  onViewProfile: (playerId: string) => void;
}

const JoinRequestCard: React.FC<JoinRequestCardProps> = ({
  player,
  onAccept,
  onDecline,
  onViewProfile,
}) => {
  const profile = player.user.profile;
  const onboarding = player.user.onboarding;
  const playerName = `${profile?.first_name || "Player"} ${
    profile?.last_name || ""
  }`.trim();
  const photoUri = profile?.photo;
  // Use handicap_range from onboarding and format it
  const handicapText =
    onboarding?.handicap_range && onboarding?.handicap_range !== "DONT_KNOW"
      ? `${formatGeneralDisplayValue(onboarding.handicap_range)} handicapper`
      : "Handicap not set";
  const distanceAway = "Xkm away"; // Placeholder - needs data source

  return (
    <LinearGradient
      colors={["#2C2C2F", "#141518"]}
      style={styles.gradientContainer}
    >
      <View style={styles.cardContent}>
        <View style={styles.playerInfoContainer}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder} />
          )}
          <View style={styles.playerTextContainer}>
            <Text style={styles.playerName}>{playerName}</Text>
            <View style={styles.playerSubDetailRow}>
              <Text style={styles.handicapText}>{handicapText}</Text>
            </View>
          </View>
        </View>
        <View style={styles.divider}></View>

        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.viewProfileButton}
            onPress={() => onViewProfile(player.user_id)}
          >
            <Text style={styles.viewProfileButtonText}>View Profile</Text>
          </TouchableOpacity>
          <View style={styles.decisionButtonsContainer}>
            <TouchableOpacity
              style={[styles.iconButton, styles.acceptButton]}
              onPress={() => onAccept(player.user_id)}
            >
              <Ionicons
                name="checkmark-outline"
                size={28}
                color={colors.text.primary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconButton, styles.declineButton]}
              onPress={() => onDecline(player.user_id)}
            >
              <Ionicons
                name="close-outline"
                size={28}
                color={colors.text.primary}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradientContainer: {
    borderRadius: spacing.md,
    marginBottom: spacing.md,
    shadowColor: colors.neutral.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  cardContent: {
    padding: spacing.md,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.surfaceSecondary,
    marginVertical: spacing.md,
  },
  playerInfoContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: spacing.md,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.neutral.placeholder, // A bit darker for placeholder
    marginRight: spacing.md,
  },
  playerTextContainer: {
    flex: 1,
  },
  playerName: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.xl,
    fontFamily: typography.fontFamily.semibold,
    letterSpacing: -1,
  },
  playerSubDetailRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  distanceText: {
    color: colors.primary.yellow, // As per image
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamily.medium,
    marginRight: spacing.sm, // Space between distance and handicap
  },
  handicapText: {
    color: colors.primary.yellow,
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamily.regular,
  },
  actionsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  viewProfileButton: {
    backgroundColor: colors.neutral.surface, // Darker button
    height: 60,
    paddingHorizontal: spacing.lg,
    borderRadius: 30, // More rounded corners
    flex: 1, // Allow to take available space
    marginRight: spacing.md,
    justifyContent: "center",
  },
  viewProfileButtonText: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.lg,
    fontFamily: typography.fontFamily.light,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  decisionButtonsContainer: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  iconButton: {
    width: 60, // Circular touch target
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: spacing.xs,
  },
  acceptButton: {
    backgroundColor: colors.semantic.success,
  },
  declineButton: {
    backgroundColor: colors.semantic.error,
  },
});

export default JoinRequestCard;
