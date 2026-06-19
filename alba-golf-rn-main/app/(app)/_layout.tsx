import ProgressHeader from "@/components/ui/ProgressHeader";
import { colors } from "@/constants/theme";
import { useAuth } from "@/providers/Auth";
import { setPendingDeepLink } from "@/utils/pendingDeepLink";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, Slot, Stack, router, usePathname } from "expo-router";
import { Pressable, View } from "react-native";

export default function AppLayout() {
  const { user, initializing } = useAuth();
  const pathname = usePathname();

  if (initializing) {
    return <Slot />;
  }

  if (!user) {
    setPendingDeepLink(pathname);
    return <Redirect href="/welcome" />;
  }

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
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="stripe-onboarding/index"
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
          headerTitle: () => <ProgressHeader currentStep={1} totalSteps={5} />,
        }}
      />
      <Stack.Screen
        name="stripe-onboarding/personal-info"
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
          headerTitle: () => <ProgressHeader currentStep={2} totalSteps={5} />,
        }}
      />
      <Stack.Screen
        name="stripe-onboarding/review"
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
          headerTitle: () => <ProgressHeader currentStep={3} totalSteps={5} />,
        }}
      />
      <Stack.Screen
        name="stripe-onboarding/terms"
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
          title: "Payment terms",
        }}
      />
      <Stack.Screen
        name="stripe-onboarding/bank-details"
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
          title: "Bank details",
        }}
      />
      <Stack.Screen
        name="stripe-onboarding/stripe-redirect"
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
          headerTitle: () => <ProgressHeader currentStep={4} totalSteps={5} />,
        }}
      />
      <Stack.Screen
        name="stripe-onboarding/complete"
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
        name="create-round/index"
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
          headerTitle: () => <ProgressHeader currentStep={1} totalSteps={6} />,
        }}
      />
      <Stack.Screen
        name="create-round/select-time-slot"
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
          headerTitle: () => <ProgressHeader currentStep={2} totalSteps={6} />,
        }}
      />
      <Stack.Screen
        name="create-round/select-round-type"
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
          headerTitle: () => <ProgressHeader currentStep={3} totalSteps={6} />,
        }}
      />
      <Stack.Screen
        name="create-round/select-round-format"
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
          headerTitle: () => <ProgressHeader currentStep={4} totalSteps={6} />,
        }}
      />
      <Stack.Screen
        name="create-round/select-course"
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
          headerTitle: () => <ProgressHeader currentStep={5} totalSteps={6} />,
        }}
      />
      <Stack.Screen
        name="create-round/review-round-details"
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
          headerTitle: () => <ProgressHeader currentStep={6} totalSteps={6} />,
        }}
      />
      <Stack.Screen
        name="round/[id]/index"
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
        name="round/[id]/report-issue"
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
        name="edit-profile/index"
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
        name="edit-availability/index"
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
        name="user/[id]"
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
        name="chat/[conversationId]"
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
        name="menu/index"
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
        name="notifications/index"
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
        name="course/[id]"
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
        name="moderation/dashboard"
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
          headerTitle: "Moderation Dashboard",
        }}
      />
      <Stack.Screen
        name="moderation/reports"
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
          headerTitle: "Reports",
        }}
      />
      <Stack.Screen
        name="moderation/content-review"
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
          headerTitle: "Content Review",
        }}
      />
    </Stack>
  );
}
