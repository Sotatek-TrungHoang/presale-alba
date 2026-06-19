import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography, borderRadius } from "@/constants/theme";

interface NoGamesNearbyStateProps {
  onStartRound: () => void;
  onSearchWider: () => void;
}

export const NoGamesNearbyState: React.FC<NoGamesNearbyStateProps> = ({
  onStartRound,
  onSearchWider,
}) => {
  return (
    <View style={styles.card}>
      <View style={styles.iconCircle}>
        <Ionicons
          name="location-outline"
          size={36}
          color={colors.primary.yellow}
        />
      </View>

      <Text style={styles.title}>No games near you yet</Text>
      <Text style={styles.subtitle}>
        Start one in 30 seconds. We'll notify nearby golfers and find your crew.
      </Text>

      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.primaryButton}
        onPress={onStartRound}
      >
        <Text style={styles.primaryButtonText}>Start a round</Text>
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.secondaryButton}
        onPress={onSearchWider}
      >
        <Text style={styles.secondaryButtonText}>Search wider area</Text>
      </TouchableOpacity>
    </View>
  );
};

const ICON_SIZE = 72;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: "center",
  },
  iconCircle: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    backgroundColor: "rgba(251, 185, 36, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  title: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.xl,
    fontFamily: typography.fontFamily.medium,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  subtitle: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
    textAlign: "center",
    marginBottom: spacing.lg,
    lineHeight: typography.fontSizes.md * 1.4,
  },
  primaryButton: {
    width: "100%",
    backgroundColor: colors.primary.yellow,
    borderRadius: borderRadius.round,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  primaryButtonText: {
    color: colors.neutral.black,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.semibold,
  },
  secondaryButton: {
    width: "100%",
    borderRadius: borderRadius.round,
    paddingVertical: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.primary.yellow,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: colors.primary.yellow,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.semibold,
  },
});

export default NoGamesNearbyState;
