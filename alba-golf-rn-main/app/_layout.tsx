import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments, Redirect, Slot } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import "react-native-reanimated";
import { StripeProvider } from "@stripe/stripe-react-native";
import * as Sentry from "@sentry/react-native";
import { fetchStripePublishableKey } from "@/api/stripe";

import { useColorScheme } from "@/hooks/useColorScheme";
import { initMetaSdk } from "@/utils/analytics";
import { initAttribution } from "@/utils/attribution";
import {
  GestureHandlerRootView,
  Pressable,
} from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { AuthProvider, useAuth } from "@/providers/Auth";
import { LocationProvider } from "@/providers/LocationProvider";
import { NotificationProvider } from "@/providers/NotificationProvider";
import { CoursesProvider } from "@/providers/CoursesProvider";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: !__DEV__ && !!process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment: process.env.EXPO_PUBLIC_SENTRY_ENV ?? "production",
  tracesSampleRate: 0.2,
});

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// This is important for Expo Router to understand the initial route
// Keep this if needed, but the logic below will handle redirection.
// export const unstable_settings = {
//   initialRouteName: "(tabs)",
// };

// Component to handle the navigation logic based on auth state
function RootLayoutNav() {
  const { user, initializing } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  if (initializing) {
    return <Slot />;
  }

  // If not authenticated, show welcome screen as entry point
  if (!user) {
    return (
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.neutral.black,
          },
          headerTintColor: colors.text.primary,
          contentStyle: {
            backgroundColor: colors.neutral.black,
          },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen
          name="login"
          options={{
            headerLeft: () => (
              <Pressable onPress={() => router.back()} style={{ padding: 5 }}>
                <Ionicons
                  name="arrow-back"
                  size={24}
                  color={colors.text.primary}
                />
              </Pressable>
            ),
            headerTitle: () => <View />,
          }}
        />
        <Stack.Screen
          name="forgot-password"
          options={{
            headerLeft: () => (
              <Pressable onPress={() => router.back()} style={{ padding: 5 }}>
                <Ionicons
                  name="arrow-back"
                  size={24}
                  color={colors.text.primary}
                />
              </Pressable>
            ),
            headerTitle: () => <View />,
          }}
        />
        <Stack.Screen
          name="reset-password"
          options={{ headerShown: false }}
        />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    );
  }

  // Authenticated users
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.neutral.black,
        },
        headerTintColor: colors.text.primary,
        contentStyle: {
          backgroundColor: colors.neutral.black,
        },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="(app)" options={{ headerShown: false }} />
      <Stack.Screen
        name="login"
        options={{
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={{ padding: 5 }}>
              <Ionicons
                name="arrow-back"
                size={24}
                color={colors.text.primary}
              />
            </Pressable>
          ),
          headerTitle: () => <View />,
        }}
      />
      <Stack.Screen
        name="reset-password"
        options={{ headerShown: false }}
      />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default Sentry.wrap(function RootLayout() {
  const colorScheme = useColorScheme();

  // Font loading
  const [fontsLoaded] = useFonts({
    "Poppins-Light": require("../assets/fonts/Poppins-Light.ttf"),
    "Poppins-Regular": require("../assets/fonts/Poppins-Regular.ttf"),
    "Poppins-Medium": require("../assets/fonts/Poppins-Medium.ttf"),
    "Poppins-SemiBold": require("../assets/fonts/Poppins-SemiBold.ttf"),
    "Poppins-Bold": require("../assets/fonts/Poppins-Bold.ttf"),
  });

  // Stripe publishable key loading
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [isFetchingKey, setIsFetchingKey] = useState(true);

  // Fetch the key on mount
  useEffect(() => {
    const getKey = async () => {
      try {
        const key = await fetchStripePublishableKey();
        setPublishableKey(key);
      } catch (error) {
        console.error("Failed to fetch Stripe publishable key:", error);
      } finally {
        setIsFetchingKey(false);
      }
    };
    getKey();
  }, []);

  // Hide splash once fonts and key are loaded
  useEffect(() => {
    if (fontsLoaded && !isFetchingKey) {
      SplashScreen.hideAsync();
      // Initialise the Meta SDK and resolve App Tracking Transparency after the
      // splash is gone, so the ATT prompt appears over the live app (per Apple).
      initMetaSdk();
      // Start capturing deep-link attribution (campaign / referral params).
      initAttribution();
    }
  }, [fontsLoaded, isFetchingKey]);

  // Only wait for fonts and key fetch to complete, but allow app to load even if key is null
  if (!fontsLoaded || isFetchingKey) {
    return null; // Wait until resources are ready
  }

  const urlScheme = "alba";

  return (
    <AuthProvider>
      <LocationProvider>
        <NotificationProvider>
          <CoursesProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <BottomSheetModalProvider>
                {publishableKey ? (
                  <StripeProvider
                    publishableKey={publishableKey}
                    urlScheme={urlScheme}
                  >
                    <ThemeProvider
                      value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
                    >
                      {/* Render the navigation component */}
                      <RootLayoutNav />
                    </ThemeProvider>
                  </StripeProvider>
                ) : (
                  <ThemeProvider
                    value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
                  >
                    {/* Render without Stripe if key failed to load */}
                    <RootLayoutNav />
                  </ThemeProvider>
                )}
              </BottomSheetModalProvider>
            </GestureHandlerRootView>
          </CoursesProvider>
        </NotificationProvider>
      </LocationProvider>
    </AuthProvider>
  );
});
