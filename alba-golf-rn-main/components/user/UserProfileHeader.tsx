import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, typography, spacing } from "@/constants/theme";

interface UserProfileHeaderProps {
  playerName: string;
  photoUri?: string;
  firstName?: string;
  lastName?: string;
  displayHandicap: string;
  displayDistance?: string;
  stats?: {
    gamesPlayed: number;
    gamesOrganized: number;
    followers: number;
  };
  children?: React.ReactNode; // For follow button, etc.
}

export const UserProfileHeader: React.FC<UserProfileHeaderProps> = ({
  playerName,
  photoUri,
  firstName,
  lastName,
  displayHandicap,
  displayDistance,
  stats,
  children,
}) => {
  return (
    <View style={styles.profileHeader}>
      {/* Profile Picture - Positioned at the top */}
      <View style={styles.imageContainer}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.profilePicture} />
        ) : (
          <View style={styles.profilePicturePlaceholder}>
            <Text style={styles.placeholderText}>
              {firstName && lastName ? `${firstName[0]}${lastName[0]}` : "?"}
            </Text>
          </View>
        )}
      </View>

      <LinearGradient
        colors={["#2C2C2F", "#000000"]}
        style={styles.gradientBackground}
      >
        <View style={styles.headerContent}>
          <View style={styles.nameContainer}>
            <Text style={styles.playerName}>{playerName}</Text>
            <Text style={styles.handicapText}>{displayHandicap}</Text>
            {displayDistance ? (
              <Text style={styles.distanceText}>{displayDistance}</Text>
            ) : null}
          </View>

          {/* Stats Row */}
          {stats && (
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{stats.gamesPlayed}</Text>
                <Text style={styles.statLabel}>Played</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{stats.gamesOrganized}</Text>
                <Text style={styles.statLabel}>Organised</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{stats.followers}</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </View>
            </View>
          )}

          {/* Slot for follow button, etc. */}
          {children}
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  profileHeader: {
    alignItems: "center",
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    position: "relative",
  },
  imageContainer: {
    width: 130,
    height: 130,
    borderRadius: 65,
    marginBottom: spacing.sm,
    zIndex: 1,
    elevation: 5,
    shadowColor: colors.neutral.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  profilePicture: {
    width: 130,
    height: 130,
    borderRadius: 65,
  },
  profilePicturePlaceholder: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: colors.neutral.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.xl,
    fontFamily: typography.fontFamily.semibold,
  },
  gradientBackground: {
    borderRadius: spacing.lg,
    marginTop: -80, // Overlap with profile picture
    paddingTop: 80, // Space for profile picture overlap
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  headerContent: {
    alignItems: "center",
  },
  nameContainer: {
    alignItems: "center",
    marginBottom: spacing.md,
  },
  playerName: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.xxl,
    fontFamily: typography.fontFamily.medium,
    letterSpacing: -0.5,
    marginBottom: spacing.xs,
    textAlign: "center",
  },
  handicapText: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamily.regular,
    marginBottom: spacing.xs,
  },
  distanceText: {
    color: colors.neutral.surfaceSecondary,
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamily.medium,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginBottom: spacing.lg,
  },
  statItem: {
    alignItems: "center",
  },
  statNumber: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.lg,
    fontFamily: typography.fontFamily.semibold,
    marginBottom: spacing.xs,
  },
  statLabel: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamily.light,
  },
});
