import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { colors, spacing, typography } from "@/constants/theme";
import { formatGeneralDisplayValue } from "@/utils/formatters";
import { PlayerType, GameType, HandicapRange } from "@/api/user"; // Assuming enums are exported from api/user.ts

// Define the expected structure for user profile and onboarding data
interface GolferProfile {
  first_name?: string | null;
  last_name?: string | null;
  photo?: string | null;
}

interface GolferOnboarding {
  handicap_range: HandicapRange | string; // Allow string for flexibility if enum not strictly passed
  player_type: PlayerType | string;
  preferences: (GameType | string)[];
}

export interface GolferUser {
  id: string;
  profile: GolferProfile | null;
  onboarding: GolferOnboarding | null;
  distanceKm?: number | null; // Added to receive distance from API
}

interface GolferCardProps {
  golfer: GolferUser;
  // onViewProfile?: (golferId: string) => void; // Optional: if we want to navigate to a full profile
}

// Helper to get display style for PlayerType and GameType lozenges
// This is a simplified version. You might want to expand this with more specific colors/styles.
const getLozengeStyle = (type: PlayerType | GameType | string) => {
  // Basic styling, can be expanded
  let backgroundColor = colors.neutral.surface; // Default
  let textColor = colors.text.primary;
  let borderColor = colors.primary.yellow; // Default border color from image

  // Example: Customizing based on type (can be more granular)
  if (type === PlayerType.CASUAL_PLAYER || type === GameType.RELAXED_ROUND) {
    // Using yellow border as per design for "Casual Player" and "Relaxed Rounds"
    borderColor = colors.primary.yellow;
    backgroundColor = "rgba(255, 199, 0, 0.1)"; // Light yellow background tint
  } else if (
    type === PlayerType.SERIOUS_COMPETITOR ||
    type === GameType.COMPETITIVE_MATCH
  ) {
    // Using red border as per design for "Competitive Match"
    borderColor = colors.semantic.error; // Example, assuming "Competitive M" is error-like
    backgroundColor = "rgba(220, 53, 69, 0.1)"; // Light red background tint
  }
  // Add more conditions for other types if needed

  return {
    view: {
      backgroundColor,
      borderColor: borderColor,
      borderWidth: 1,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: spacing.xl, // Rounded lozenges
      marginRight: spacing.sm,
      marginBottom: spacing.sm, // For wrapping
    },
    text: {
      color: textColor, //colors.text.primary, // Use primary text color, or adjust per type
      fontSize: typography.fontSizes.xs,
      fontFamily: typography.fontFamily.medium,
    },
  };
};

const GolferCard: React.FC<GolferCardProps> = ({ golfer }) => {
  const profile = golfer.profile;
  const onboarding = golfer.onboarding;

  const playerName = `${profile?.first_name || "Golfer"} ${
    profile?.last_name || ""
  }`.trim();
  const photoUri = profile?.photo;

  const handicapText =
    onboarding?.handicap_range &&
    onboarding?.handicap_range !== HandicapRange.DONT_KNOW &&
    onboarding?.handicap_range !== "DONT_KNOW"
      ? `${formatGeneralDisplayValue(onboarding.handicap_range as string)}` // Let formatter handle capitalization
      : "Handicap not set";

  // Ensure handicapText ends with "Handicapper" if not already, and isn't "Handicap not set"
  const displayHandicap =
    handicapText !== "Handicap not set" &&
    !handicapText.toLowerCase().includes("handicapper")
      ? `${handicapText}-Handicapper`
      : handicapText;

  // Determine displayDistance based on golfer.distanceKm
  let displayDistance = "";
  if (typeof golfer.distanceKm === "number") {
    if (golfer.distanceKm < 1) {
      displayDistance = "<1km away";
    } else {
      displayDistance = `${Math.round(golfer.distanceKm)}km away`;
    }
  }

  const handlePress = () => {
    router.push(`/user/${golfer.id}`);
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
      <LinearGradient
        colors={["#2C2C2F", "#141518"]} // Dark card background
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
                {/* Display actual distance if available */}
                {displayDistance ? (
                  <Text style={styles.distanceText}>{displayDistance}</Text>
                ) : null}
                <Text style={styles.handicapText}>{displayHandicap}</Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollViewContentContainer}
          >
            <View style={styles.tagsContainer}>
              {onboarding?.player_type && (
                <View
                  style={
                    getLozengeStyle(onboarding.player_type as PlayerType).view
                  }
                >
                  <Text
                    style={
                      getLozengeStyle(onboarding.player_type as PlayerType).text
                    }
                  >
                    {formatGeneralDisplayValue(
                      onboarding.player_type as string
                    )}
                  </Text>
                </View>
              )}
              {onboarding?.preferences?.map((pref, index) => (
                <View
                  key={index}
                  style={getLozengeStyle(pref as GameType).view}
                >
                  <Text style={getLozengeStyle(pref as GameType).text}>
                    {formatGeneralDisplayValue(pref as string)}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  gradientContainer: {
    borderRadius: spacing.md,
    marginBottom: spacing.md,
    marginHorizontal: spacing.sm, // Added to give some space like in the image
    shadowColor: colors.neutral.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  cardContent: {
    padding: spacing.md,
  },
  playerInfoContainer: {
    flexDirection: "row",
    alignItems: "center",
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
    backgroundColor: colors.neutral.placeholder,
    marginRight: spacing.md,
  },
  playerTextContainer: {
    flex: 1,
  },
  playerName: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.lg, // Slightly smaller than JoinRequestCard's xl
    fontFamily: typography.fontFamily.semibold,
    letterSpacing: -0.5, // Adjusted letter spacing
  },
  playerSubDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xs / 2,
  },
  distanceText: {
    color: colors.primary.yellow,
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamily.medium,
    marginRight: spacing.xs, // Smaller gap
  },
  handicapText: {
    color: colors.text.secondary, // Greyish color from image
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamily.regular,
  },
  separatorText: {
    color: colors.text.secondary, // Or a more subtle separator color
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamily.regular,
    marginHorizontal: spacing.xs, // Add space around the separator
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.surfaceSecondary, // Match JoinRequestCard
    marginVertical: spacing.md,
  },
  scrollViewContentContainer: {
    // Add padding here if you want space at the start/end of the scrollable content
    // e.g., paddingHorizontal: spacing.xs,
  },
  tagsContainer: {
    flexDirection: "row", // Keep items in a row
    // flexWrap: "wrap", // Remove flexWrap to prevent wrapping
    alignItems: "center",
    marginTop: spacing.xs,
  },
  // Lozenge styles are now generated by getLozengeStyle,
  // but you can keep base styles here if needed or for other types of tags.
});

export default GolferCard;
