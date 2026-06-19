import React, { useEffect, useRef, useState } from "react";
import { colors, spacing, typography } from "@/constants/theme";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  Easing,
  Alert,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useStripeOnboardingStore } from "@/stores/stripeOnboardingStore";
import { initiateStripeOnboarding } from "@/api/stripe";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";

export default function StripeRedirect() {
  const { individual, email } = useStripeOnboardingStore();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Animation values
  const headingOpacity = useRef(new Animated.Value(0)).current;
  const headingTranslateY = useRef(new Animated.Value(-20)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0.8)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(-20)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonTranslateY = useRef(new Animated.Value(30)).current;

  // Start animations
  useEffect(() => {
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

      // Icon animation
      Animated.timing(iconOpacity, {
        toValue: 1,
        duration: 600,
        delay: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(iconScale, {
        toValue: 1,
        duration: 600,
        delay: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),

      // Text animation
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 600,
        delay: 400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(textTranslateY, {
        toValue: 0,
        duration: 600,
        delay: 400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),

      // Button animation
      Animated.timing(buttonOpacity, {
        toValue: 1,
        duration: 500,
        delay: 600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(buttonTranslateY, {
        toValue: 0,
        duration: 500,
        delay: 600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleContinueToStripe = async () => {
    setIsSubmitting(true);
    setError(null);

    // --- Data Validation & Preparation ---
    if (
      !email ||
      !individual?.first_name ||
      !individual?.last_name ||
      !individual?.phone ||
      !individual?.dob?.day ||
      !individual?.dob?.month ||
      !individual?.dob?.year ||
      !individual?.address?.line1 ||
      !individual?.address?.city ||
      !individual?.address?.postal_code
    ) {
      const missingFields = [] as string[];
      if (!email) missingFields.push("Email");
      if (!individual?.first_name) missingFields.push("First Name");
      if (!individual?.last_name) missingFields.push("Last Name");
      if (!individual?.phone) missingFields.push("Phone");
      if (!individual?.dob?.day) missingFields.push("DOB Day");
      if (!individual?.dob?.month) missingFields.push("DOB Month");
      if (!individual?.dob?.year) missingFields.push("DOB Year");
      if (!individual?.address?.line1) missingFields.push("Address Line 1");
      if (!individual?.address?.city) missingFields.push("City");
      if (!individual?.address?.postal_code) missingFields.push("Postal Code");

      setError(
        `Missing required information: ${missingFields.join(
          ", "
        )}. Please go back and complete the form.`
      );
      Alert.alert(
        "Incomplete Information",
        `Please ensure all required fields are filled: ${missingFields.join(
          ", "
        )}.`
      );
      setIsSubmitting(false);
      return;
    }

    // Prepare data strictly matching the API DTO
    const apiData = {
      email: email,
      individual: {
        email: email,
        first_name: individual.first_name,
        last_name: individual.last_name,
        phone: individual.phone,
        dob: {
          day: individual.dob.day as number,
          month: individual.dob.month as number,
          year: individual.dob.year as number,
        },
        address: {
          line1: individual.address.line1,
          city: individual.address.city,
          postal_code: individual.address.postal_code,
          ...(individual.address.line2 && { line2: individual.address.line2 }),
        },
      },
    };

    try {
      const response = await initiateStripeOnboarding(apiData);
      const stripeUrl = response.url;

      if (stripeUrl) {
        Linking.openURL(stripeUrl);
      } else {
        const message = `Cannot open the Stripe URL: ${stripeUrl}`;
        setError(message);
        Alert.alert(
          "Error Opening Link",
          "Could not open the Stripe onboarding link in your browser."
        );
      }
    } catch (err: any) {
      console.error("Stripe onboarding initiation failed:", err);
      const message =
        err.message || "An unexpected error occurred during Stripe setup.";
      setError(message);
      Alert.alert("Onboarding Failed", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  console.log(individual);

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
            <Text style={styles.title}>Almost there — continue on Stripe</Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.iconSection,
              {
                opacity: iconOpacity,
                transform: [{ scale: iconScale }],
              },
            ]}
          >
            <View style={styles.iconContainer}>
              <Ionicons
                name="shield-checkmark-outline"
                size={48}
                color={colors.primary.yellow}
              />
            </View>
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
              Stripe will quickly verify your details and grab your bank info so
              we know where to pay you.
            </Text>
            <Text style={styles.description}>
              On Stripe you’ll be asked to:
            </Text>
            <View style={styles.bulletPoints}>
              <Text style={styles.bulletPoint}>• Confirm your details</Text>
              <Text style={styles.bulletPoint}>• Add your bank details</Text>
            </View>
            {/* <Text style={styles.securityNote}>
              We never see your bank details — Stripe handles that securely.
            </Text> */}
            <Text style={styles.description}>
              Stripe may describe you as an 'individual/sole trader' on their form - this just means they're not treating you as a business.
            </Text>

            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
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
          <SubmitButton
            title={
              isSubmitting ? "Connecting to Stripe..." : "Continue to Stripe"
            }
            onPress={handleContinueToStripe}
            isLoading={isSubmitting}
            disabled={isSubmitting}
          />
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
    marginBottom: spacing.xl,
  },
  title: {
    color: colors.text.primary,
    fontSize: 28,
    fontFamily: typography.fontFamily.semibold,
    textAlign: "center",
  },
  iconSection: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.neutral.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  textSection: {
    marginBottom: spacing.xl,
  },
  description: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
    marginBottom: spacing.lg,
    lineHeight: 24,
    textAlign: "left",
  },
  bulletPoints: {
    alignSelf: "flex-start",
    marginBottom: spacing.lg,
  },
  bulletPoint: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 32,
  },
  securityNote: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.bold,
    fontStyle: "italic",
    textAlign: "left",
    marginTop: spacing.sm,
  },
  buttonContainer: {
    paddingBottom: spacing.lg,
  },
  errorContainer: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.neutral.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.primary.red,
  },
  errorText: {
    color: colors.primary.red,
    textAlign: "center",
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSizes.sm,
  },
});
