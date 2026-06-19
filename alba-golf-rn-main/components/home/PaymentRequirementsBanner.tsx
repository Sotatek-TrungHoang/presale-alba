import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "@/constants/theme";
import { useStripeRequirements } from "@/hooks/useStripeRequirements";

export default function PaymentRequirementsBanner() {
  const router = useRouter();
  const { outstandingCount, pastDueCount, loading } = useStripeRequirements();

  if (loading || outstandingCount === 0) return null;

  const isUrgent = pastDueCount > 0;
  const message = isUrgent
    ? "Stripe needs additional info before your next payout. Action required."
    : "Stripe needs a little more info to keep payouts flowing.";

  return (
    <TouchableOpacity
      style={[styles.container, isUrgent && styles.urgent]}
      onPress={() => router.push("/(app)/stripe-onboarding/requirements")}
      activeOpacity={0.85}
    >
      <View style={styles.iconWrap}>
        <Ionicons
          name={isUrgent ? "alert-circle" : "information-circle"}
          size={22}
          color={isUrgent ? colors.primary.red : colors.primary.yellow}
        />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>Action needed</Text>
        <Text style={styles.message} numberOfLines={2}>
          {message}
        </Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={20}
        color={colors.text.secondary}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.neutral.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary.yellow,
  },
  urgent: { borderColor: colors.primary.red },
  iconWrap: { marginRight: spacing.md },
  textWrap: { flex: 1 },
  title: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.semibold,
  },
  message: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamily.regular,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
});
