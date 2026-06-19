import React, { useEffect, useRef, useState } from "react";
import { colors, spacing, typography } from "@/constants/theme";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  Easing,
  ActivityIndicator,
  Linking,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useStripeOnboardingStore } from "@/stores/stripeOnboardingStore";
import { getStripeOnboardingStatus } from "@/api/stripe";

export default function StripeOnboardingIndex() {
  const { setStep, syncWithProfile } = useStripeOnboardingStore();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Animation values
  const headingOpacity = useRef(new Animated.Value(0)).current;
  const headingTranslateY = useRef(new Animated.Value(-20)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(-20)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonTranslateY = useRef(new Animated.Value(30)).current;

  // Start animations
  useEffect(() => {
    // Sync with profile when the page loads
    syncWithProfile();

    Animated.parallel([
      // Heading animation
      Animated.timing(headingOpacity, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(headingTranslateY, {
        toValue: 0,
        duration: 600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),

      // Text animation
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 600,
        delay: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(textTranslateY, {
        toValue: 0,
        duration: 600,
        delay: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),

      // Button animation
      Animated.timing(buttonOpacity, {
        toValue: 1,
        duration: 500,
        delay: 400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(buttonTranslateY, {
        toValue: 0,
        duration: 500,
        delay: 400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Fetch status and redirect if necessary
  useFocusEffect(
    React.useCallback(() => {
      let isActive = true; // Prevent state updates if component unmounts
      setIsLoading(true);
      setError(null);

      const checkStatus = async () => {
        try {
          const result = await getStripeOnboardingStatus();

          if (isActive) {
            if (
              result.status !== "not_started" &&
              result.detailsSubmitted === true
            ) {
              console.log(
                "StripeOnboardingIndex: Redirecting to complete screen based on status or details_submitted."
              );
              router.replace("/(app)/stripe-onboarding/complete");
              // No need to set loading false here as we are navigating away
            } else {
              // Status is 'not_started', or detailsSubmitted is false, proceed with showing the index page
              setIsLoading(false);
            }
          }
        } catch (err: any) {
          console.error("StripeOnboardingIndex: Failed to fetch status:", err);
          if (isActive) {
            setError(
              err.message ||
                "Failed to check onboarding status. Please try again."
            );
            setIsLoading(false);
          }
        }
      };

      checkStatus();

      return () => {
        isActive = false; // Cleanup function to set isActive to false
      };
    }, []) // Empty dependency array ensures it runs on focus
  );

  const handleNext = () => {
    setStep(1);
    router.push("/(app)/stripe-onboarding/personal-info");
  };

  // Loading State
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.text.primary} />
          <Text style={styles.loadingText}>Checking onboarding status...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error State
  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
          {/* Optionally add a retry button */}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      <View style={styles.outerContainer}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContentContainer}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            style={[
              styles.headerSection,
              {
                opacity: headingOpacity,
                transform: [{ translateY: headingTranslateY }],
              },
            ]}
          >
            <Text style={styles.title}>Let’s get you set up</Text>
            <Text style={styles.title}>to organise</Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.textSection,
              {
                opacity: textOpacity,
                transform: [{ translateY: textTranslateY }],
              },
            ]}
          >
            <Text style={styles.description}>
              Ready to organise your first round? 
            </Text>
            <Text style={styles.description}>
              Firstly, we need to activate payouts so that we can send you money after your round has been played. 
            </Text>
            <Text style={styles.description}>
             Alba uses a trusted payment platform, Stripe, for this.
            </Text>
          </Animated.View>
        </ScrollView>

        <Animated.View
          style={[
            styles.buttonContainer,
            {
              opacity: buttonOpacity,
              transform: [{ translateY: buttonTranslateY }],
            },
          ]}
        >
          <SubmitButton title="Continue" onPress={handleNext} />
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.black,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
    backgroundColor: colors.neutral.black,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.text.secondary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
  },
  errorText: {
    color: colors.primary.red,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.medium,
    textAlign: "center",
  },
  outerContainer: {
    flex: 1,
    justifyContent: "space-between",
    padding: spacing.lg,
  },
  scrollView: {
    flexShrink: 1,
  },
  scrollContentContainer: {
    paddingTop: spacing.lg,
  },
  headerSection: {
    alignItems: "center",
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
  title: {
    color: colors.text.primary,
    fontSize: 28,
    fontWeight: "600",
    textAlign: "center",
  },
  textSection: {
    marginBottom: spacing.xl * 2,
  },
  description: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
    marginBottom: spacing.lg,
    lineHeight: 24,
    textAlign: "center",
  },
  buttonContainer: {
    paddingBottom: spacing.lg,
  },
  learnMoreLink: {
    color: colors.primary.yellow,
    textAlign: "center",
    marginTop: spacing.sm,
    fontFamily: typography.fontFamily.medium,
  },
  trustText: {
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: spacing.xs,
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamily.regular,
  },
});
