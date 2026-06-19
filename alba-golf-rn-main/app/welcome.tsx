import {
  View,
  Image,
  StyleSheet,
  Pressable,
  Text,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useAuth } from "@/hooks/useAuth";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { consumePendingDeepLink } from "@/utils/pendingDeepLink";

export default function WelcomeScreen() {
  const router = useRouter();
  const { loginWithGoogle, loginWithApple } = useAuth();
  const [isGoogleLoggingIn, setIsGoogleLoggingIn] = useState(false);
  const [isAppleLoggingIn, setIsAppleLoggingIn] = useState(false);

  const handleGoogleSignIn = async () => {
    if (isGoogleLoggingIn) return;
    setIsGoogleLoggingIn(true);
    try {
      const result = await loginWithGoogle();

      if (result.needsOnboarding) {
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
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Image
          source={require("@/assets/images/alba-transparent.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>
      <View style={styles.buttonContainer}>
        <SubmitButton
          title="Lets's Get Started"
          fullWidth
          onPress={() =>
            router.push({ pathname: "/login", params: { mode: "onboarding" } })
          }
        />
        <SubmitButton
          title="Login"
          variant="outline"
          fullWidth
          style={{ marginTop: 16 }}
          onPress={() =>
            router.push({ pathname: "/login", params: { mode: "login" } })
          }
        />
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
            <ActivityIndicator size="small" color="#000000" />
          ) : (
            <>
              <Ionicons
                name="logo-google"
                size={20}
                color="#000000"
                style={styles.socialButtonIcon}
              />
              <Text style={styles.socialButtonText}>Continue with Google</Text>
            </>
          )}
        </Pressable>
        {Platform.OS === "ios" && (
          <Pressable
            style={({ pressed }) => [
              styles.socialButton,
              pressed && styles.socialButtonPressed,
            ]}
            onPress={handleAppleSignIn}
            disabled={isAppleLoggingIn}
            accessibilityRole="button"
            accessibilityLabel="Continue with Apple"
          >
            {isAppleLoggingIn ? (
              <ActivityIndicator size="small" color="#000000" />
            ) : (
              <>
                <Ionicons
                  name="logo-apple"
                  size={20}
                  color="#000000"
                  style={styles.socialButtonIcon}
                />
                <Text style={styles.socialButtonText}>Continue with Apple</Text>
              </>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "space-between",
  },
  logoContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: "100%",
    height: 200,
    maxWidth: 400,
  },
  buttonContainer: {
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  socialButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingHorizontal: 24,
    height: Platform.OS === "ios" ? 60 : 52,
    width: "100%",
    marginTop: 16,
  },
  socialButtonPressed: {
    opacity: 0.85,
  },
  socialButtonIcon: {
    marginRight: 8,
  },
  socialButtonText: {
    color: "#000000",
    fontSize: Platform.OS === "ios" ? 16 : 14,
    fontFamily: "Poppins-Regular",
  },
});
