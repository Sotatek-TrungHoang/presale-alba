import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  Animated,
  Easing,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect, useRef, useCallback } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyledInput, SubmitButton, Heading } from "@/components/ui";
import { colors, spacing, typography } from "@/constants/theme";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";

type Status = "verifying" | "ready" | "invalid" | "submitting" | "success";

export default function ResetPassword() {
  const { verifyPasswordResetCode, confirmPasswordReset } = useAuth();
  const { oobCode } = useLocalSearchParams<{ oobCode?: string }>();

  const [status, setStatus] = useState<Status>("verifying");
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [isFormValid, setIsFormValid] = useState(false);

  const headingOpacity = useRef(new Animated.Value(0)).current;
  const headingTranslateY = useRef(new Animated.Value(-20)).current;
  const inputsOpacity = useRef(new Animated.Value(0)).current;
  const inputsTranslateY = useRef(new Animated.Value(20)).current;
  const buttonsOpacity = useRef(new Animated.Value(0)).current;
  const buttonsTranslateY = useRef(new Animated.Value(30)).current;

  // Verify the oobCode once on mount
  useEffect(() => {
    let cancelled = false;
    const verify = async () => {
      if (!oobCode) {
        setStatus("invalid");
        setVerifyError("This reset link is missing a code. Request a new one.");
        return;
      }
      try {
        const email = await verifyPasswordResetCode(oobCode);
        if (cancelled) return;
        setAccountEmail(email);
        setStatus("ready");
      } catch (e: any) {
        if (cancelled) return;
        setStatus("invalid");
        setVerifyError(
          e?.message ||
            "This reset link is invalid or has expired. Request a new one."
        );
      }
    };
    verify();
    return () => {
      cancelled = true;
    };
  }, [oobCode]);

  useEffect(() => {
    validateForm();
  }, [password, confirm, passwordTouched, confirmTouched]);

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
    const minLength = 8;
    const hasNumber = /\d/.test(password);
    const hasPunctuation = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (passwordTouched) {
      if (!password) {
        setPasswordError("");
      } else if (password.length < minLength) {
        setPasswordError(`Password must be at least ${minLength} characters`);
      } else if (!hasNumber) {
        setPasswordError("Password must include at least one number");
      } else if (!hasPunctuation) {
        setPasswordError("Password must include at least one special character");
      } else {
        setPasswordError("");
      }
    }

    if (confirmTouched) {
      if (!confirm) {
        setConfirmError("");
      } else if (confirm !== password) {
        setConfirmError("Passwords don't match");
      } else {
        setConfirmError("");
      }
    }

    const pwValid =
      !!password &&
      password.length >= minLength &&
      hasNumber &&
      hasPunctuation;
    setIsFormValid(pwValid && !!confirm && confirm === password);
  };

  const handleSubmit = async () => {
    if (!isFormValid || !oobCode) return;
    setStatus("submitting");
    try {
      await confirmPasswordReset(oobCode, password);
      setStatus("success");
    } catch (error: any) {
      console.error(error);
      setStatus("ready");
      Alert.alert(
        "Couldn't reset password",
        error.message || "An unexpected error occurred. Please try again."
      );
    }
  };

  const goToLogin = () => router.replace("/login" as any);

  if (status === "verifying") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.text.primary} />
          <Text style={[styles.subheading, { marginTop: spacing.md }]}>
            Verifying your reset link…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (status === "invalid") {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollViewContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerSection}>
            <Heading level={1} weight="light">
              Link expired
            </Heading>
            <Text style={styles.subheading}>{verifyError}</Text>
          </View>
          <View style={styles.buttonSection}>
            <SubmitButton
              title="Request a new link"
              fullWidth
              onPress={() => router.replace("/forgot-password" as any)}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (status === "success") {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollViewContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerSection}>
            <Heading level={1} weight="light">
              Password updated
            </Heading>
            <Text style={styles.subheading}>
              You can now sign in with your new password.
            </Text>
          </View>
          <View style={styles.buttonSection}>
            <SubmitButton title="Sign in" fullWidth onPress={goToLogin} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

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
                Choose a new password
              </Heading>
              {accountEmail ? (
                <Text style={styles.subheading}>
                  for {accountEmail}
                </Text>
              ) : null}
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
                  label="New password"
                  placeholder="Enter a new password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  error={passwordError}
                  onBlur={() => setPasswordTouched(true)}
                  autoFocus
                />
                {passwordError ? (
                  <Text style={styles.errorText}>{passwordError}</Text>
                ) : null}
              </View>

              <View style={styles.inputContainer}>
                <StyledInput
                  label="Confirm password"
                  placeholder="Re-enter your new password"
                  value={confirm}
                  onChangeText={setConfirm}
                  secureTextEntry
                  error={confirmError}
                  onBlur={() => setConfirmTouched(true)}
                />
                {confirmError ? (
                  <Text style={styles.errorText}>{confirmError}</Text>
                ) : null}
              </View>
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
              title="Update password"
              fullWidth
              onPress={handleSubmit}
              isLoading={status === "submitting"}
              disabled={!isFormValid}
            />
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
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
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
    marginTop: spacing.lg,
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
});
