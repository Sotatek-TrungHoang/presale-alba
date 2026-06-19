import {
  View,
  StyleSheet,
  Text,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Animated,
  Easing,
  Alert,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect, useRef, useCallback } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyledInput, SubmitButton, Heading } from "@/components/ui";
import { colors, spacing, typography } from "@/constants/theme";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { consumePendingDeepLink } from "@/utils/pendingDeepLink";
import { useOnboardingStore } from "@/stores/onboardingStore";

export default function Login() {
  const { login, register, loginWithGoogle, loginWithApple } = useAuth();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const emailInputRef = useRef(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isGoogleLoggingIn, setIsGoogleLoggingIn] = useState(false);
  const [isAppleLoggingIn, setIsAppleLoggingIn] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [isFormValid, setIsFormValid] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false);

  const isOnboarding = mode === "onboarding";

  // --- Animation Values ---
  const headingOpacity = useRef(new Animated.Value(0)).current;
  const headingTranslateY = useRef(new Animated.Value(-20)).current;

  const inputsOpacity = useRef(new Animated.Value(0)).current;
  const inputsTranslateY = useRef(new Animated.Value(20)).current;

  const buttonsOpacity = useRef(new Animated.Value(0)).current;
  const buttonsTranslateY = useRef(new Animated.Value(30)).current;
  // ------------------------

  // Validate form whenever email or password changes
  useEffect(() => {
    validateForm();
  }, [
    email,
    password,
    confirmPassword,
    emailTouched,
    passwordTouched,
    confirmPasswordTouched,
    mode,
  ]);

  // Apply entrance animations on focus
  useFocusEffect(
    useCallback(() => {
      // Reset animations
      headingOpacity.setValue(0);
      headingTranslateY.setValue(-20);
      inputsOpacity.setValue(0);
      inputsTranslateY.setValue(20);
      buttonsOpacity.setValue(0);
      buttonsTranslateY.setValue(30);

      // Define animations
      const headingAnim = Animated.parallel([
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
      ]);

      const inputsAnim = Animated.parallel([
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
      ]);

      const buttonsAnim = Animated.parallel([
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
      ]);

      // Start animations
      Animated.parallel([headingAnim, inputsAnim, buttonsAnim]).start();
    }, []) // Run only on focus
  );

  // Email validation
  const validateEmail = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (emailTouched) {
      if (!email) {
        // Don't show "required" error
        return false;
      } else if (!emailRegex.test(email)) {
        setEmailError("Please enter a valid email address");
        return false;
      } else {
        setEmailError("");
      }
    }

    return !!email && emailRegex.test(email);
  };

  // Password validation
  const validatePassword = () => {
    // Password requirements
    const minLength = 8;
    const hasNumber = /\d/.test(password);
    const hasPunctuation = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (passwordTouched) {
      if (!password) {
        // Don't show "required" error
        return false;
      } else if (password.length < minLength) {
        setPasswordError(`Password must be at least ${minLength} characters`);
        return false;
      } else if (!hasNumber) {
        setPasswordError("Password must include at least one number");
        return false;
      } else if (!hasPunctuation) {
        setPasswordError(
          "Password must include at least one special character"
        );
        return false;
      } else {
        setPasswordError("");
      }
    }

    return (
      !!password && password.length >= minLength && hasNumber && hasPunctuation
    );
  };

  // Confirm password validation (signup only)
  const validateConfirmPassword = () => {
    if (confirmPasswordTouched) {
      if (!confirmPassword) {
        setConfirmPasswordError("");
      } else if (confirmPassword !== password) {
        setConfirmPasswordError("Passwords don't match");
      } else {
        setConfirmPasswordError("");
      }
    }
    return !!confirmPassword && confirmPassword === password;
  };

  // Combined validation
  const validateForm = () => {
    const isEmailValid = validateEmail();
    const isPasswordValid = validatePassword();
    if (isOnboarding) {
      const isConfirmValid = validateConfirmPassword();
      setIsFormValid(isEmailValid && isPasswordValid && isConfirmValid);
    } else {
      setIsFormValid(isEmailValid && isPasswordValid);
    }
  };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    // if (!emailTouched) setEmailTouched(true);
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    // if (!passwordTouched) setPasswordTouched(true);
  };

  const handleConfirmPasswordChange = (text: string) => {
    setConfirmPassword(text);
  };

  const handleLogin = async () => {
    if (!isFormValid) return;

    setIsLoggingIn(true);
    try {
      await login(email, password);
      if (mode === "onboarding") {
        router.replace({
          pathname: "/onboarding/step1",
          params: { email, password },
        });
      } else {
        const pending = consumePendingDeepLink();
        router.replace((pending ?? "/") as any);
      }
    } catch (error: any) {
      console.error(error);
      Alert.alert(
        "Login Failed",
        error.message || "An unexpected error occurred. Please try again."
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRegister = () => {
    if (!isFormValid) return;
    // Always go to onboarding/step1 for registration
    router.navigate({
      pathname: "/onboarding/step1",
      params: { email, password },
    });
  };

  const handleGoogleSignIn = async () => {
    if (isGoogleLoggingIn) return;
    setIsGoogleLoggingIn(true);
    try {
      const result = await loginWithGoogle();

      if (result.needsOnboarding) {
        // Seed the onboarding store with Google's data, then route to step1.
        const store = useOnboardingStore.getState();
        store.reset();
        store.setAuthProvider("google");
        store.setCredentials(result.prefill.email, "");
        store.setPersonalInfo(
          result.prefill.firstName,
          result.prefill.lastName
        );
        router.replace("/onboarding/step1");
        return;
      }

      const pending = consumePendingDeepLink();
      router.replace((pending ?? "/") as any);
    } catch (error: any) {
      // Silently swallow user cancellations.
      if (error?.name === "auth/google-cancelled") return;
      console.error(error);
      Alert.alert(
        "Sign-in Failed",
        error?.message || "An unexpected error occurred. Please try again."
      );
    } finally {
      setIsGoogleLoggingIn(false);
    }
  };

  const handleAppleSignIn = async () => {
    if (isAppleLoggingIn) return;
    setIsAppleLoggingIn(true);
    try {
      const result = await loginWithApple();

      if (result.needsOnboarding) {
        const store = useOnboardingStore.getState();
        store.reset();
        store.setAuthProvider("apple");
        store.setCredentials(result.prefill.email, "");
        store.setPersonalInfo(
          result.prefill.firstName,
          result.prefill.lastName
        );
        router.replace("/onboarding/step1");
        return;
      }

      const pending = consumePendingDeepLink();
      router.replace((pending ?? "/") as any);
    } catch (error: any) {
      if (error?.name === "auth/apple-cancelled") return;
      console.error(error);
      Alert.alert(
        "Sign-in Failed",
        error?.message || "An unexpected error occurred. Please try again."
      );
    } finally {
      setIsAppleLoggingIn(false);
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
                Welcome{mode === "onboarding" ? "" : " Back"}
              </Heading>
            </Animated.View>

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
                  onChangeText={handleEmailChange}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  error={emailError}
                  onBlur={() => setEmailTouched(true)}
                  autoFocus
                />
                {emailError && (
                  <Text style={styles.errorText}>{emailError}</Text>
                )}
              </View>

              <View style={styles.inputContainer}>
                <StyledInput
                  label="Password"
                  placeholder="Enter your password"
                  value={password}
                  onChangeText={handlePasswordChange}
                  secureTextEntry
                  error={passwordError}
                  onBlur={() => setPasswordTouched(true)}
                />
                {passwordError && (
                  <Text style={styles.errorText}>{passwordError}</Text>
                )}
              </View>

              {isOnboarding && (
                <View style={styles.inputContainer}>
                  <StyledInput
                    label="Confirm Password"
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChangeText={handleConfirmPasswordChange}
                    secureTextEntry
                    error={confirmPasswordError}
                    onBlur={() => setConfirmPasswordTouched(true)}
                  />
                  {confirmPasswordError && (
                    <Text style={styles.errorText}>{confirmPasswordError}</Text>
                  )}
                </View>
              )}

              {!isOnboarding && (
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: "/forgot-password" as any,
                      params: email ? { email } : {},
                    })
                  }
                  style={styles.forgotPasswordButton}
                  hitSlop={8}
                >
                  <Text style={styles.forgotPasswordText}>
                    Forgot password?
                  </Text>
                </Pressable>
              )}
            </Animated.View>
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
            <SubmitButton
              title="Continue"
              fullWidth
              onPress={mode === "onboarding" ? handleRegister : handleLogin}
              isLoading={isLoggingIn}
              disabled={!isFormValid}
            />

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.socialButton,
                pressed && styles.socialButtonPressed,
              ]}
              onPress={handleGoogleSignIn}
              disabled={isGoogleLoggingIn}
              accessibilityRole="button"
              accessibilityLabel="Continue with Google"
            >
              {isGoogleLoggingIn ? (
                <ActivityIndicator
                  size="small"
                  color={colors.neutral.black}
                />
              ) : (
                <>
                  <Ionicons
                    name="logo-google"
                    size={20}
                    color={colors.neutral.black}
                    style={styles.socialButtonIcon}
                  />
                  <Text style={styles.socialButtonText}>
                    Continue with Google
                  </Text>
                </>
              )}
            </Pressable>

            {Platform.OS === "ios" && (
              <Pressable
                style={({ pressed }) => [
                  styles.socialButton,
                  { marginTop: spacing.sm },
                  pressed && styles.socialButtonPressed,
                ]}
                onPress={handleAppleSignIn}
                disabled={isAppleLoggingIn}
                accessibilityRole="button"
                accessibilityLabel="Continue with Apple"
              >
                {isAppleLoggingIn ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.neutral.black}
                  />
                ) : (
                  <>
                    <Ionicons
                      name="logo-apple"
                      size={20}
                      color={colors.neutral.black}
                      style={styles.socialButtonIcon}
                    />
                    <Text style={styles.socialButtonText}>
                      Continue with Apple
                    </Text>
                  </>
                )}
              </Pressable>
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
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  formContainer: {
    // Remove flex: 1 and justifyContent: 'space-between'
  },
  contentSection: {
    // Remove flex: 1 and justifyContent: 'center'
  },
  headerSection: {
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  inputSection: {
    marginTop: spacing.md,
  },
  buttonSection: {
    marginTop: spacing.sm,
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
  forgotPasswordButton: {
    alignSelf: "flex-end",
    paddingVertical: spacing.xs,
  },
  forgotPasswordText: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.sm,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.text.secondary,
    opacity: 0.4,
  },
  dividerText: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.sm,
    marginHorizontal: spacing.md,
  },
  socialButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    height: Platform.OS === "ios" ? 60 : 52,
  },
  socialButtonPressed: {
    opacity: 0.85,
  },
  socialButtonIcon: {
    marginRight: spacing.sm,
  },
  socialButtonText: {
    color: colors.neutral.black,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
  },
});
