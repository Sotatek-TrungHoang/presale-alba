import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  Easing,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useStripe } from "@stripe/stripe-react-native";
import { colors, spacing, typography } from "@/constants/theme";
import { StyledInput } from "@/components/ui/StyledInput";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useStripeOnboardingStore } from "@/stores/stripeOnboardingStore";
import { attachStripeExternalAccount } from "@/api/stripe";

const SORT_CODE_REGEX = /^\d{6}$/;
const ACCOUNT_NUMBER_REGEX = /^\d{8}$/;

export default function StripeBankDetails() {
  const { individual, setStep, resetOnboarding } = useStripeOnboardingStore();
  const { createToken } = useStripe();
  const params = useLocalSearchParams<{ mode?: string }>();
  const isRequirementsMode = params.mode === "requirements";

  const defaultHolderName =
    `${individual.first_name ?? ""} ${individual.last_name ?? ""}`.trim();

  const [holderName, setHolderName] = useState(defaultHolderName);
  const [sortCode, setSortCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headingOpacity = useRef(new Animated.Value(0)).current;
  const headingTranslateY = useRef(new Animated.Value(-20)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;
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
      Animated.timing(formOpacity, {
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

  const normalisedSortCode = sortCode.replace(/\D/g, "");
  const normalisedAccountNumber = accountNumber.replace(/\D/g, "");
  const isFormValid =
    holderName.trim().length > 0 &&
    SORT_CODE_REGEX.test(normalisedSortCode) &&
    ACCOUNT_NUMBER_REGEX.test(normalisedAccountNumber);

  const handleSubmit = async () => {
    if (!isFormValid || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const { token, error: tokenError } = await createToken({
        type: "BankAccount",
        accountHolderName: holderName.trim(),
        accountHolderType: "Individual",
        accountNumber: normalisedAccountNumber,
        routingNumber: normalisedSortCode,
        country: "GB",
        currency: "gbp",
      });

      if (tokenError || !token) {
        const message =
          tokenError?.message ??
          "Couldn't validate your bank details. Please double-check and try again.";
        setError(message);
        Alert.alert("Bank details error", message);
        return;
      }

      await attachStripeExternalAccount(token.id);

      // Requirements-mode: just dismiss back to the requirements screen so it
      // re-fetches and the bank line disappears. Don't reset the store state
      // because the user might be mid-fix on something else.
      if (isRequirementsMode) {
        router.back();
        return;
      }

      resetOnboarding();
      setStep(5);
      router.replace("/(app)/stripe-onboarding/complete");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
      Alert.alert("Couldn't save bank details", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 50 : 0}
      >
        <View style={styles.outer}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View
              style={{
                opacity: headingOpacity,
                transform: [{ translateY: headingTranslateY }],
              }}
            >
              <Text style={styles.title}>Where should we send your money?</Text>
              <Text style={styles.subtitle}>
                Your bank details are encrypted and sent directly to Stripe.
              </Text>
            </Animated.View>

            <Animated.View style={[styles.form, { opacity: formOpacity }]}>
              <Text style={styles.label}>Account Holder Name</Text>
              <StyledInput
                label="Account Holder"
                value={holderName}
                onChangeText={setHolderName}
                placeholder="Name on the account"
              />

              <Text style={styles.label}>Sort Code</Text>
              <StyledInput
                label="Sort Code"
                value={sortCode}
                onChangeText={(v) => setSortCode(v.replace(/\D/g, "").slice(0, 6))}
                placeholder="6 digits, no dashes"
                keyboardType="number-pad"
                maxLength={6}
              />

              <Text style={styles.label}>Account Number</Text>
              <StyledInput
                label="Account Number"
                value={accountNumber}
                onChangeText={(v) =>
                  setAccountNumber(v.replace(/\D/g, "").slice(0, 8))
                }
                placeholder="8 digits"
                keyboardType="number-pad"
                maxLength={8}
              />

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
              title={isSubmitting ? "Saving..." : "Finish setup"}
              onPress={handleSubmit}
              disabled={!isFormValid || isSubmitting}
              isLoading={isSubmitting}
            />
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
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
  form: { marginTop: spacing.xl },
  label: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.light,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    marginLeft: spacing.sm,
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
