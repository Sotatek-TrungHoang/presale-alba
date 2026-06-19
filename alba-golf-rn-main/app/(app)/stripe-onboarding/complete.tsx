import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Easing,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getStripeOnboardingStatus } from "@/api/stripe";
import { colors, spacing, typography } from "@/constants/theme";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useStripeOnboardingStore } from "@/stores/stripeOnboardingStore";

// Define the structure for the status state
interface StatusState {
  loading: boolean;
  status: "active" | "pending_verification" | "not_started" | "error" | "idle";
  payoutsEnabled: boolean | null;
  accountType: "EXPRESS" | "CUSTOM" | null;
  error: string | null;
}

export default function StripeComplete() {
  const [statusInfo, setStatusInfo] = useState<StatusState>({
    loading: true,
    status: "idle",
    payoutsEnabled: null,
    accountType: null,
    error: null,
  });

  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;

  // Function to fetch status
  const fetchStatus = async () => {
    console.log("StripeComplete: Fetching status...");
    setStatusInfo((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const result = await getStripeOnboardingStatus();
      console.log("StripeComplete: Status fetched:", result);
      setStatusInfo({
        loading: false,
        status: result.status,
        payoutsEnabled: result.payoutsEnabled,
        accountType: result.accountType,
        error: null,
      });
      // Trigger animation after loading
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    } catch (err: any) {
      console.error("StripeComplete: Failed to fetch status:", err);
      setStatusInfo({
        loading: false,
        status: "error",
        payoutsEnabled: null,
        accountType: null,
        error: err.message || "Failed to load onboarding status.",
      });
      // Trigger animation even on error to show error message
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  // Use useFocusEffect to fetch status when the screen comes into focus
  // This handles the case where the user returns from the in-app browser
  useFocusEffect(
    React.useCallback(() => {
      opacity.setValue(0); // Reset animation on focus
      scale.setValue(0.9);
      fetchStatus();
    }, [])
  );

  const handleDone = () => {
    router.replace("/" as any);
  };

  const handleOrganiseRound = () => {
    router.push("/(app)/create-round");
  };

  const resetOnboarding = useStripeOnboardingStore(
    (state) => state.resetOnboarding,
  );

  const handleStartReOnboarding = () => {
    // Clear any stale tosAccepted / stripeAccountId from prior flow.
    resetOnboarding();
    router.push("/(app)/stripe-onboarding/personal-info");
  };

  // The 25 existing users on the legacy Express setup see a soft prompt to
  // re-onboard. Their account keeps working in the meantime; the swap to
  // Custom only happens once they complete the new flow.
  const showReOnboardingPrompt =
    !statusInfo.loading &&
    statusInfo.accountType === "EXPRESS" &&
    statusInfo.payoutsEnabled === true;

  // Determine icon and message based on status
  let iconName: keyof typeof Ionicons.glyphMap = "alert-circle-outline";
  let title = "Checking Status...";
  let message = "Please wait while we confirm your Stripe account status.";
  let iconColor = colors.text.secondary;

  if (!statusInfo.loading) {
    if (statusInfo.status === "error") {
      iconName = "close-circle-outline";
      title = "Error";
      message = statusInfo.error || "Could not retrieve onboarding status.";
      iconColor = colors.primary.red;
    } else if (statusInfo.payoutsEnabled) {
      iconName = "checkmark-circle-outline";
      title = "Account Ready!";
      message = "Your account is connected and ready to receive payments.";
      iconColor = colors.semantic.success;
    } else if (statusInfo.status === "pending_verification") {
      iconName = "hourglass-outline";
      title = "Verification Pending";
      message =
        "Stripe is verifying your details. This usually takes a few minutes, but can sometimes take longer. We'll notify you when it's complete.";
      iconColor = colors.primary.orange; // Or a pending color
    } else {
      // Catch-all for not_started or other unexpected states
      iconName = "alert-circle-outline";
      title = "Onboarding Incomplete";
      message =
        "It looks like the Stripe onboarding wasn't fully completed. You may need to try again later.";
      iconColor = colors.text.secondary;
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      <View style={styles.contentContainer}>
        {statusInfo.loading ? (
          <View style={styles.centerContent}>
            <ActivityIndicator size="small" color={colors.text.primary} />
            <Text style={[styles.message, { marginTop: spacing.md }]}>
              Checking status...
            </Text>
          </View>
        ) : (
          <Animated.View
            style={[styles.centerContent, { opacity, transform: [{ scale }] }]}
          >
            <Ionicons name={iconName} size={80} color={iconColor} />
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>

            {showReOnboardingPrompt && (
              <View style={styles.reOnboardingBanner}>
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color={colors.primary.yellow}
                />
                <Text style={styles.reOnboardingBannerText}>
                  We've upgraded our payment setup. Your account still works,
                  but please take a moment to update it when you can.
                </Text>
              </View>
            )}
          </Animated.View>
        )}
      </View>

      <View style={styles.buttonContainer}>
        {showReOnboardingPrompt ? (
          <>
            <SubmitButton
              title="Update payment setup"
              onPress={handleStartReOnboarding}
              style={{ marginBottom: spacing.md }}
            />
            <SubmitButton title="Done" onPress={handleDone} />
          </>
        ) : !statusInfo.loading && statusInfo.payoutsEnabled ? (
          <>
            <SubmitButton
              title="Organise a round"
              onPress={handleOrganiseRound}
              style={{ marginBottom: spacing.md }}
            />
            <SubmitButton title="Done" onPress={handleDone} />
          </>
        ) : (
          <SubmitButton
            title={statusInfo.status === "error" ? "Try Again Later" : "Done"}
            onPress={handleDone}
            disabled={statusInfo.loading}
            style={{ opacity: statusInfo.loading ? 0 : 1 }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.black,
  },
  contentContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  centerContent: {
    alignItems: "center",
    textAlign: "center",
  },
  reOnboardingBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginTop: spacing.xl,
    padding: spacing.md,
    backgroundColor: colors.neutral.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary.yellow,
  },
  reOnboardingBannerText: {
    flex: 1,
    color: colors.text.primary,
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 20,
  },
  title: {
    color: colors.text.primary,
    fontSize: 26,
    fontFamily: typography.fontFamily.semibold,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    textAlign: "center",
  },
  message: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: spacing.sm,
  },
  buttonContainer: {
    padding: spacing.lg,
    backgroundColor: colors.neutral.black, // Match background
  },
});
