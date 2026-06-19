import { Stack, router } from "expo-router";
import { colors } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";
import { ProgressHeader } from "@/components/ui";

// Define initial route for the onboarding flow
export const unstable_settings = {
  initialRouteName: "step1",
};

export default function OnboardingLayout() {
  const handleBackToLogin = () => {
    router.push("/login");
  };

  const handleBack = () => {
    router.back();
  };

  // Total number of steps in the onboarding process
  const totalSteps = 5;

  // Common header style options
  const commonHeaderOptions = {
    headerTitleAlign: "center" as const,
    headerShadowVisible: false,
  };

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
      <Stack.Screen
        name="step1"
        options={{
          headerLeft: () => (
            <Pressable onPress={handleBackToLogin} style={{ padding: 5 }}>
              <Ionicons
                name="arrow-back"
                size={24}
                color={colors.text.primary}
              />
            </Pressable>
          ),
          headerTitle: () => (
            <ProgressHeader currentStep={1} totalSteps={totalSteps} />
          ),
          ...commonHeaderOptions,
        }}
      />
      <Stack.Screen
        name="step2"
        options={{
          headerLeft: () => (
            <Pressable onPress={handleBack} style={{ padding: 5 }}>
              <Ionicons
                name="arrow-back"
                size={24}
                color={colors.text.primary}
              />
            </Pressable>
          ),
          headerTitle: () => (
            <ProgressHeader currentStep={2} totalSteps={totalSteps} />
          ),
          ...commonHeaderOptions,
        }}
      />
      <Stack.Screen
        name="step3"
        options={{
          headerLeft: () => (
            <Pressable onPress={handleBack} style={{ padding: 5 }}>
              <Ionicons
                name="arrow-back"
                size={24}
                color={colors.text.primary}
              />
            </Pressable>
          ),
          headerTitle: () => (
            <ProgressHeader currentStep={3} totalSteps={totalSteps} />
          ),
          ...commonHeaderOptions,
        }}
      />
      <Stack.Screen
        name="step4"
        options={{
          headerLeft: () => (
            <Pressable onPress={handleBack} style={{ padding: 5 }}>
              <Ionicons
                name="arrow-back"
                size={24}
                color={colors.text.primary}
              />
            </Pressable>
          ),
          headerTitle: () => (
            <ProgressHeader currentStep={4} totalSteps={totalSteps} />
          ),
          ...commonHeaderOptions,
        }}
      />
      {/* <Stack.Screen
        name="step5"
        options={{
          headerLeft: () => (
            <Pressable onPress={handleBack} style={{ padding: 5 }}>
              <Ionicons
                name="arrow-back"
                size={24}
                color={colors.text.primary}
              />
            </Pressable>
          ),
          headerTitle: () => (
            <ProgressHeader currentStep={5} totalSteps={totalSteps} />
          ),
          ...commonHeaderOptions,
        }}
      /> */}
      {/* <Stack.Screen
        name="step6"
        options={{
          headerLeft: () => (
            <Pressable onPress={handleBack} style={{ padding: 5 }}>
              <Ionicons
                name="arrow-back"
                size={24}
                color={colors.text.primary}
              />
            </Pressable>
          ),
          headerTitle: () => (
            <ProgressHeader currentStep={5} totalSteps={totalSteps} />
          ),
          ...commonHeaderOptions,
        }}
      /> */}
      <Stack.Screen
        name="step7"
        options={{
          headerLeft: () => (
            <Pressable onPress={handleBack} style={{ padding: 5 }}>
              <Ionicons
                name="arrow-back"
                size={24}
                color={colors.text.primary}
              />
            </Pressable>
          ),
          headerTitle: () => (
            <ProgressHeader currentStep={5} totalSteps={totalSteps} />
          ),
          ...commonHeaderOptions,
        }}
      />
    </Stack>
  );
}
