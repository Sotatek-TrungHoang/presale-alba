import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  Animated,
  Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "@/constants/theme";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useStripeOnboardingStore } from "@/stores/stripeOnboardingStore";
import { createStripeCustomAccount } from "@/api/stripe";

const STRIPE_CONNECTED_ACCOUNT_AGREEMENT_URL =
  "https://stripe.com/legal/connect-account";

export default function StripeTerms() {
  const {
    individual,
    setStep,
    tosAccepted,
    setTosAccepted,
    setStripeAccountId,
  } = useStripeOnboardingStore();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headingOpacity = useRef(new Animated.Value(0)).current;
  const headingTranslateY = useRef(new Animated.Value(-20)).current;
  const bodyOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonTranslateY = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headingOpacity, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(headingTranslateY, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(bodyOpacity, {
        toValue: 1,
        duration: 500,
        delay: 100,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(buttonOpacity, {
        toValue: 1,
        duration: 500,
        delay: 250,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(buttonTranslateY, {
        toValue: 0,
        duration: 500,
        delay: 250,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const openAgreement = () => {
    Linking.openURL(STRIPE_CONNECTED_ACCOUNT_AGREEMENT_URL).catch(() =>
      Alert.alert("Couldn't open the agreement", "Please try again.")
    );
  };

  const handleContinue = async () => {
    if (!tosAccepted) return;

    if (
      !individual.first_name ||
      !individual.last_name ||
      !individual.phone ||
      !individual.email ||
      !individual.dob.day ||
      !individual.dob.month ||
      !individual.dob.year ||
      !individual.address.line1 ||
      !individual.address.city ||
      !individual.address.postal_code
    ) {
      setError(
        "Some information is missing. Please go back and complete the form."
      );
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await createStripeCustomAccount({
        tos_accepted: true,
        individual: {
          email: individual.email,
          phone: individual.phone,
          first_name: individual.first_name,
          last_name: individual.last_name,
          dob: {
            day: individual.dob.day as number,
            month: individual.dob.month as number,
            year: individual.dob.year as number,
          },
          address: {
            line1: individual.address.line1,
            city: individual.address.city,
            postal_code: individual.address.postal_code,
            ...(individual.address.line2
              ? { line2: individual.address.line2 }
              : {}),
          },
        },
      });
      setStripeAccountId(response.accountId);
      setStep(4);
      router.push("/(app)/stripe-onboarding/bank-details");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
      Alert.alert("Couldn't create account", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      <View style={styles.outer}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          <Animated.View
            style={{
              opacity: headingOpacity,
              transform: [{ translateY: headingTranslateY }],
            }}
          >
            <Text style={styles.title}>One last thing</Text>
          </Animated.View>

          <Animated.View style={{ opacity: bodyOpacity, marginTop: spacing.xl }}>
            <Text style={styles.body}>
              We use Stripe to handle payments because they're the reliable, behind-the-scenes bit. By continuing, you're agreeing to their Connected Account Terms, which cover how they verify you and move your money around.
            </Text>
            <Text style={styles.body}>
              They only see what they need to pay you out. Nothing more.
            </Text>

            <TouchableOpacity
              onPress={openAgreement}
              style={styles.linkRow}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.linkText}>
                Read the Connected Account Agreement
              </Text>
              <Ionicons
                name="open-outline"
                size={18}
                color={colors.primary.yellow}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setTosAccepted(!tosAccepted)}
              style={styles.checkboxRow}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.checkbox,
                  tosAccepted && styles.checkboxChecked,
                ]}
              >
                {tosAccepted && (
                  <Ionicons
                    name="checkmark"
                    size={18}
                    color={colors.neutral.black}
                  />
                )}
              </View>
              <Text style={styles.checkboxLabel}>
                I agree to the Connected Account Agreement
              </Text>
            </TouchableOpacity>

            {error && (
              <View style={styles.errorBox}>
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
            title={isSubmitting ? "Setting up..." : "Continue"}
            onPress={handleContinue}
            disabled={!tosAccepted || isSubmitting}
            isLoading={isSubmitting}
          />
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral.black },
  outer: { flex: 1, justifyContent: "space-between", padding: spacing.lg },
  scroll: { flexShrink: 1 },
  scrollContent: { paddingTop: spacing.lg },
  title: {
    color: colors.text.primary,
    fontSize: 28,
    fontFamily: typography.fontFamily.semibold,
    textAlign: "center",
  },
  subtitle: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
    textAlign: "center",
    marginTop: spacing.md,
  },
  body: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.xl,
  },
  linkText: {
    color: colors.primary.yellow,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.medium,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.primary.yellow,
    marginRight: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: colors.primary.yellow },
  checkboxLabel: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
    flex: 1,
  },
  errorBox: {
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
  buttonContainer: { paddingBottom: spacing.lg },
});
