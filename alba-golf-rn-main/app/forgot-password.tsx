import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  Animated,
  Easing,
  Alert,
  Pressable,
} from "react-native";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect, useRef, useCallback } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyledInput, SubmitButton, Heading } from "@/components/ui";
import { colors, spacing, typography } from "@/constants/theme";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";

export default function ForgotPassword() {
  const { sendPasswordReset } = useAuth();
  const { email: initialEmail } = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(initialEmail ?? "");
  const [emailError, setEmailError] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [isFormValid, setIsFormValid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const headingOpacity = useRef(new Animated.Value(0)).current;
  const headingTranslateY = useRef(new Animated.Value(-20)).current;
  const inputsOpacity = useRef(new Animated.Value(0)).current;
  const inputsTranslateY = useRef(new Animated.Value(20)).current;
  const buttonsOpacity = useRef(new Animated.Value(0)).current;
  const buttonsTranslateY = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    validateForm();
  }, [email, emailTouched]);

  useFocusEffect(
    useCallback(() => {
      headingOpacity.setValue(0);
      headingTranslateY.setValue(-20);
      inputsOpacity.setValue(0);
      inputsTranslateY.setValue(20);
      buttonsOpacity.setValue(0);
      buttonsTranslateY.setValue(30);

      Animated.parallel([
        Animated.parallel([
          Animated.timing(headingOpacity, {
            toValue: 1,
            duration: 1000,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(headingTranslateY, {
            toValue: 0,
            duration: 1000,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(inputsOpacity, {
            toValue: 1,
            duration: 500,
            delay: 300,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(inputsTranslateY, {
            toValue: 0,
            duration: 500,
            delay: 300,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(buttonsOpacity, {
            toValue: 1,
            duration: 500,
            delay: 450,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(buttonsTranslateY, {
            toValue: 0,
            duration: 500,
            delay: 450,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }, [])
  );

  const validateForm = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const valid = !!email && emailRegex.test(email);

    if (emailTouched) {
      if (!email) {
        setEmailError("");
      } else if (!emailRegex.test(email)) {
        setEmailError("Please enter a valid email address");
      } else {
        setEmailError("");
      }
    }

    setIsFormValid(valid);
  };

  const handleSubmit = async () => {
    if (!isFormValid) return;
    setIsSubmitting(true);
    try {
      await sendPasswordReset(email);
      setSubmitted(true);
    } catch (error: any) {
      console.error(error);
      Alert.alert(
        "Couldn't send reset email",
        error.message || "An unexpected error occurred. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollViewContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.formContainer}>
          <View style={styles.contentSection}>
            <Animated.View
              style={[
                styles.headerSection,
                {
                  opacity: headingOpacity,
                  transform: [{ translateY: headingTranslateY }],
                },
              ]}
            >
              <Heading level={1} weight="light">
                {submitted ? "Check your email" : "Reset your password"}
              </Heading>
              <Text style={styles.subheading}>
                {submitted
                  ? `If an account exists for ${email}, we've sent a link to reset your password.`
                  : "Enter the email address associated with your account and we'll send you a link to reset your password."}
              </Text>
            </Animated.View>

            {!submitted && (
              <Animated.View
                style={[
                  styles.inputSection,
                  {
                    opacity: inputsOpacity,
                    transform: [{ translateY: inputsTranslateY }],
                  },
                ]}
              >
                <View style={styles.inputContainer}>
                  <StyledInput
                    label="Email"
                    placeholder="Enter your email"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    error={emailError}
                    onBlur={() => setEmailTouched(true)}
                    autoFocus
                  />
                  {emailError ? (
                    <Text style={styles.errorText}>{emailError}</Text>
                  ) : null}
                </View>
              </Animated.View>
            )}
          </View>

          <Animated.View
            style={[
              styles.buttonSection,
              {
                opacity: buttonsOpacity,
                transform: [{ translateY: buttonsTranslateY }],
              },
            ]}
          >
            {submitted ? (
              <SubmitButton
                title="Back to login"
                fullWidth
                onPress={() => router.back()}
              />
            ) : (
              <>
                <SubmitButton
                  title="Send reset link"
                  fullWidth
                  onPress={handleSubmit}
                  isLoading={isSubmitting}
                  disabled={!isFormValid}
                />
                <Pressable
                  onPress={() => router.back()}
                  style={styles.secondaryAction}
                >
                  <Text style={styles.secondaryActionText}>
                    Back to login
                  </Text>
                </Pressable>
              </>
            )}
          </Animated.View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.black,
  },
  scrollViewContent: {
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  formContainer: {},
  contentSection: {},
  headerSection: {
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  subheading: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.md,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  inputSection: {
    marginTop: spacing.md,
  },
  buttonSection: {
    marginTop: spacing.lg,
    paddingBottom: 0,
  },
  inputContainer: {
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.semantic.error,
    fontSize: typography.fontSizes.sm,
    marginTop: spacing.xs,
  },
  secondaryAction: {
    marginTop: spacing.md,
    alignItems: "center",
    padding: spacing.sm,
  },
  secondaryActionText: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.md,
  },
});
