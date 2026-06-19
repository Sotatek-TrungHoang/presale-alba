import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "@/constants/theme";

interface GolferProtectionProps {
  gameDate?: string | null; // Game date as an ISO string or similar
  testID?: string;
}

export const GolferProtection: React.FC<GolferProtectionProps> = ({
  gameDate,
  testID,
}) => {
  let refundDeadlineText = "two days before the round"; // Fallback text

  if (gameDate) {
    try {
      const dateObj = new Date(gameDate);
      dateObj.setDate(dateObj.getDate() - 2); // Subtract 2 days
      refundDeadlineText = dateObj.toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    } catch (e) {
      console.error("Error formatting game date for refund policy:", e);
      // Fallback text is already set
    }
  }

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.headerRow}>
        <Ionicons
          name="shield-checkmark-outline"
          size={20}
          color={colors.text.primary}
          style={styles.icon}
        />
        <Text style={styles.title}>Golfer Protection</Text>
      </View>
      <Text style={styles.text}>
        You will automatically receive a refund if the round is cancelled by the
        organiser.
      </Text>
      <View style={styles.divider} />
      <Text style={styles.text}>
        Your payment is held securely until we know the round has gone ahead
        smoothly.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.neutral.black,
    borderWidth: 1,
    borderColor: colors.text.secondary,
    padding: spacing.md,
    borderRadius: spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  icon: {
    marginRight: spacing.sm,
  },
  title: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.semibold,
  },
  text: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.xs,
    fontFamily: typography.fontFamily.regular,
  },
  divider: {
    height: spacing.md, // Or use spacing.md perhaps, if that fits better
  },
});
