import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  Image,
  Platform,
  Alert,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { SafeAreaView } from "react-native-safe-area-context";
import { SubmitButton, Heading } from "@/components/ui";
import { colors, spacing, typography } from "@/constants/theme";
import { router } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import { consumePendingDeepLink } from "@/utils/pendingDeepLink";
import { Ionicons } from "@expo/vector-icons";
import { GolfCourse } from "@/api/courses";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
// Import the DTO and enums
import {
  CreateUserWithOnboardingDto,
  HandicapRange,
  PlayerType,
  GameType,
  TimeSlot,
} from "@/api/user";
import { getGameTypeStyle } from "@/utils/formatters";

// Copy formatEnumText and getPlayerTypeStyleFromPalette from edit-profile
const formatEnumText = (text: string) => {
  return text
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (l) => l.toUpperCase());
};
const ALL_PLAYER_TYPES = Object.values(PlayerType);
const PLAYER_TYPE_STYLE_PALETTE = [
  {
    backgroundColor: "#4A4129",
    borderColor: colors.primary.yellow,
    textColor: colors.text.primary,
  },
  {
    backgroundColor: "#4F362A",
    borderColor: colors.primary.orange,
    textColor: colors.text.primary,
  },
  {
    backgroundColor: "#442222",
    borderColor: colors.primary.red,
    textColor: colors.text.primary,
  },
  {
    backgroundColor: "#4D3240",
    borderColor: colors.primary.pink,
    textColor: colors.text.primary,
  },
];
const getPlayerTypeStyleFromPalette = (playerType: PlayerType) => {
  const index = ALL_PLAYER_TYPES.indexOf(playerType);
  return PLAYER_TYPE_STYLE_PALETTE[index % PLAYER_TYPE_STYLE_PALETTE.length];
};

// Helper function to translate Firebase errors to user-friendly messages
const getErrorMessage = (error: any): string => {
  // Handle Firebase Auth errors
  if (error?.code) {
    switch (error.code) {
      case "auth/email-already-in-use":
        return "An account with this email address already exists. Please try signing in instead.";
      case "auth/invalid-email":
        return "Please enter a valid email address.";
      case "auth/weak-password":
        return "Password should be at least 6 characters long.";
      case "auth/network-request-failed":
        return "Network error. Please check your internet connection and try again.";
      case "auth/too-many-requests":
        return "Too many failed attempts. Please try again later.";
      case "auth/user-disabled":
        return "This account has been disabled. Please contact support.";
      default:
        return "Registration failed. Please try again.";
    }
  }

  // Handle generic errors
  if (error?.message) {
    return error.message;
  }

  return "An unexpected error occurred. Please try again.";
};

export default function OnboardingFinalStep() {
  const { register, completeSocialOnboarding } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);

  // Get all data from our store
  const {
    authProvider,
    email,
    password,
    firstName,
    lastName,
    handicap,
    playerType,
    matchTypes,
    availability,
    selectedCourse,
    reset,
  } = useOnboardingStore();

  // --- Mappers from store string values to backend enums ---
  const mapHandicapToEnum = (value: string | null): HandicapRange => {
    switch (value) {
      case "LOW":
        return HandicapRange.LOW;
      case "MID":
        return HandicapRange.MID;
      case "HIGH":
        return HandicapRange.HIGH;
      default:
        return HandicapRange.DONT_KNOW; // Default or handle error
    }
  };

  const mapPlayerTypeToEnum = (value: string | null): PlayerType => {
    switch (value) {
      case "CASUAL PLAYER":
        return PlayerType.CASUAL_PLAYER;
      case "DEDICATED IMPROVER":
        return PlayerType.DEDICATED_IMPROVER;
      case "SERIOUS COMPETITOR":
        return PlayerType.SERIOUS_COMPETITOR;
      case "NEW TO GOLF":
        return PlayerType.NEW_TO_GOLF;
      default:
        // Handle potentially null/invalid value - maybe default or throw error
        return PlayerType.CASUAL_PLAYER; // Example default
    }
  };

  const mapMatchTypesToEnum = (values: string[]): GameType[] => {
    const mapping: { [key: string]: GameType } = {
      SOCIAL: GameType.PURELY_SOCIAL,
      "RELAXED ROUNDS": GameType.RELAXED_ROUND,
      "COMPETITIVE MATCHES": GameType.COMPETITIVE_MATCH,
      "BEGINNER FRIENDLY": GameType.BEGINNER_FRIENDLY,
    };
    return values
      .map((value) => mapping[value])
      .filter((enumValue): enumValue is GameType => enumValue !== undefined);
  };

  const mapAvailabilityToDto = (
    avail: typeof availability
  ): { weekdays?: TimeSlot[]; weekends?: TimeSlot[] } => {
    const timeSlotMapping: { [key: string]: TimeSlot } = {
      EARLY_MORNING: TimeSlot.EARLY_MORNING,
      LATE_MORNING: TimeSlot.LATE_MORNING,
      LUNCH_TIME: TimeSlot.LUNCHTIME,
      LATE_AFTERNOON: TimeSlot.LATE_AFTERNOON,
      EVENING: TimeSlot.EVENING,
    };

    return {
      weekdays: avail.weekdays
        ?.map((slot) => timeSlotMapping[slot])
        .filter((enumValue): enumValue is TimeSlot => enumValue !== undefined),
      weekends: avail.weekends
        ?.map((slot) => timeSlotMapping[slot])
        .filter((enumValue): enumValue is TimeSlot => enumValue !== undefined),
    };
  };

  // --- Animation Values ---
  const headingOpacity = useRef(new Animated.Value(0)).current;
  const headingTranslateY = useRef(new Animated.Value(-20)).current;
  const descriptionOpacity = useRef(new Animated.Value(0)).current;
  // ------------------------

  // Add useFocusEffect for entry animations
  useFocusEffect(
    useCallback(() => {
      // Reset animations
      headingOpacity.setValue(0);
      headingTranslateY.setValue(-20);
      descriptionOpacity.setValue(0);
      // Section animations are handled within the AnimatedSection component's useEffect

      // Define animations
      const headingAnim = Animated.parallel([
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
      ]);

      const descriptionAnim = Animated.timing(descriptionOpacity, {
        toValue: 1,
        duration: 500,
        delay: 100, // Slightly after heading
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      });

      // Start animations
      Animated.parallel([headingAnim, descriptionAnim]).start();
    }, []) // Run only on focus
  );

  const handleFinish = async () => {
    if (authProvider === "email" && (!email || !password)) {
      console.error("Missing credentials");
      return;
    }

    setIsRegistering(true);
    try {
      const onboardingDetails = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        handicapRange: mapHandicapToEnum(handicap),
        playerType: mapPlayerTypeToEnum(playerType),
        preferences: mapMatchTypesToEnum(matchTypes),
        availability: mapAvailabilityToDto(availability),
        // homeCourses: [selectedCourse?.id ?? ''],
      };

      if (authProvider === "google" || authProvider === "apple") {
        // Firebase user already exists (created during the social sign-in).
        // Just create the backend profile.
        await completeSocialOnboarding(onboardingDetails);
      } else {
        // Email/password: create Firebase user + backend profile.
        await register(email, password, onboardingDetails);
      }

      reset();

      const pending = consumePendingDeepLink();
      router.replace((pending ?? "/") as any);
    } catch (error) {
      console.error("Registration failed:", error);
      Alert.alert("Registration Failed", getErrorMessage(error));
    } finally {
      setIsRegistering(false);
    }
  };

  // For navigateToStep, use a simpler approach without dynamic paths
  const navigateToStep = (step: number) => {
    // Go back to preserve history stack
    // router.back(); // REMOVED - This caused navigation to step 6 first

    // Minor delay to ensure back navigation completes - REMOVED
    // setTimeout(() => {
    // Hard-code cases for type safety
    switch (step) {
      case 1:
        // router.push("/onboarding/step1");
        router.replace("/onboarding/step1");
        break;
      case 2:
        // router.push("/onboarding/step2");
        router.replace("/onboarding/step2");
        break;
      case 3:
        // router.push("/onboarding/step3");
        router.replace("/onboarding/step3");
        break;
      case 4:
        // router.push("/onboarding/step4");
        router.replace("/onboarding/step4");
        break;
      case 5:
        // router.push("/onboarding/step5");
        router.replace("/onboarding/step5");
        break;
      case 6:
        // router.push("/onboarding/step6");
        router.replace("/onboarding/step6");
        break;
      default:
        // router.push("/onboarding/step1");
        router.replace("/onboarding/step1");
    }
    // }, 100);
  };

  // Format time slot for display
  const formatTimeSlot = (slot: string) => {
    switch (slot) {
      case "EARLY_MORNING":
        return "Early Morning (6am-9am)";
      case "LATE_MORNING":
        return "Late Morning (9am-12pm)";
      case "LUNCH_TIME":
        return "Lunch Time (12pm-3pm)";
      case "LATE_AFTERNOON":
        return "Late Afternoon (3pm-6pm)";
      case "EVENINGS":
        return "Evenings (After 6pm)";
      default:
        return slot;
    }
  };

  // Helper for rendering chips (edit-profile style)
  const renderHandicapChip = (value: string | null) => {
    if (!value) return null;
    return (
      <View style={[styles.optionButton]}>
        <Text style={[styles.optionText, styles.selectedOptionText]}>
          {formatEnumText(value)}
        </Text>
      </View>
    );
  };
  const renderPlayerTypeChip = (value: string | null) => {
    if (!value) return null;
    const enumValue = mapPlayerTypeToEnum(value);
    const styleInfo = getPlayerTypeStyleFromPalette(enumValue);
    return (
      <View
        style={[
          styles.optionButton,
          {
            backgroundColor: styleInfo.backgroundColor,
            borderColor: styleInfo.borderColor,
          },
        ]}
      >
        <Text
          style={[
            styles.optionText,
            {
              color: styleInfo.textColor,
              fontFamily: typography.fontFamily.medium,
            },
          ]}
        >
          {formatEnumText(value)}
        </Text>
      </View>
    );
  };
  const renderPreferenceChip = (value: string, idx: number) => {
    const enumValue = mapMatchTypesToEnum([value])[0];
    const styleFromFormatter = getGameTypeStyle(enumValue);
    return (
      <View
        key={value + idx}
        style={[
          styles.optionButton,
          styleFromFormatter.lozengeStyle,
          !styleFromFormatter.lozengeStyle.hasOwnProperty("borderColor") &&
            styles.selectedOptionButtonGenericBorder,
        ]}
      >
        <Text style={[styles.optionText, styles.selectedPreferenceText]}>
          {formatEnumText(value)}
        </Text>
      </View>
    );
  };
  const renderCourseChip = (course: GolfCourse) => (
    <View key={course.id} style={[styles.optionButton]}>
      <Text style={[styles.optionText, styles.selectedOptionText]}>
        {course.name}
      </Text>
    </View>
  );
  const renderAvailabilityChips = (slots: string[]) => {
    return slots.map((slot, idx) => (
      <View key={slot + idx} style={[styles.optionButton]}>
        <Text style={[styles.optionText, styles.selectedOptionText]}>
          {formatEnumText(slot)}
        </Text>
      </View>
    ));
  };

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContentContainer}
      >
        <Animated.View
          style={[
            styles.headerContent,
            {
              opacity: headingOpacity,
              transform: [{ translateY: headingTranslateY }],
            },
          ]}
        >
          <Heading level={1} weight="medium" style={styles.title}>
            You're All Set!
          </Heading>
        </Animated.View>

        <Animated.Text
          style={[styles.description, { opacity: descriptionOpacity }]}
        >
          Check your details below — you can edit later anytime.
        </Animated.Text>

        <LinearGradient
          colors={[colors.neutral.surface, colors.neutral.black]}
          style={styles.gradientCard}
        >
          <View style={styles.summaryInnerContainer}>
            {/* Personal Info */}
            <View style={styles.sectionRow}>
              <View style={styles.sectionLabelValueRow}>
                <Text style={styles.sectionLabel}>Name</Text>
                <Text style={styles.sectionValue}>
                  {firstName} {lastName}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => navigateToStep(1)}
              >
                <Ionicons
                  name="create-outline"
                  size={18}
                  color={colors.primary.yellow}
                />
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            </View>
            {/* Handicap */}
            <View style={styles.sectionRow}>
              <View style={styles.sectionLabelValueRow}>
                <Text style={styles.sectionLabel}>Handicap</Text>
                {handicap ? (
                  renderHandicapChip(handicap)
                ) : (
                  <Text style={styles.sectionValue}>-</Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => navigateToStep(2)}
              >
                <Ionicons
                  name="create-outline"
                  size={18}
                  color={colors.primary.yellow}
                />
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            </View>
            {/* Player Type */}
            <View style={styles.sectionRow}>
              <View style={styles.sectionLabelValueRow}>
                <Text style={styles.sectionLabel}>Player Type</Text>
                {playerType ? (
                  renderPlayerTypeChip(playerType)
                ) : (
                  <Text style={styles.sectionValue}>-</Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => navigateToStep(3)}
              >
                <Ionicons
                  name="create-outline"
                  size={18}
                  color={colors.primary.yellow}
                />
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            </View>
            {/* Match Types */}
            <View style={styles.sectionRow}>
              <View style={styles.sectionLabelValueRow}>
                <Text style={styles.sectionLabel}>Preferences</Text>
                <View style={styles.optionGroup}>
                  {matchTypes.length > 0 ? (
                    matchTypes.map((type, idx) =>
                      renderPreferenceChip(type, idx)
                    )
                  ) : (
                    <Text style={styles.sectionValue}>-</Text>
                  )}
                </View>
              </View>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => navigateToStep(4)}
              >
                <Ionicons
                  name="create-outline"
                  size={18}
                  color={colors.primary.yellow}
                />
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            </View>
            {/* Home Course */}
            {/* <View style={styles.sectionRow}>
              <View style={styles.sectionLabelValueRow}>
                <Text style={styles.sectionLabel}>Home Course</Text>
                <View style={styles.optionGroup}>
                  {selectedCourse ? (
                    renderCourseChip(selectedCourse)
                  ) : (
                    <Text style={styles.sectionValue}>-</Text>
                  )}
                </View>
              </View>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => navigateToStep(6)}
              >
                <Ionicons
                  name="create-outline"
                  size={18}
                  color={colors.primary.yellow}
                />
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            </View> */}
          </View>
        </LinearGradient>
        <View style={styles.termsContainer}>
          <Text style={styles.termsText}>
            By clicking "Complete Registration", you agree to our{" "}
            <Text
              style={styles.termsLink}
              onPress={() =>
                WebBrowser.openBrowserAsync(
                  "https://www.golfalba.co/alba-policies"
                )
              }
            >
              Terms of Acceptable Use
            </Text>
          </Text>
        </View>
      </ScrollView>
      {/* Sticky Button Container */}
      <View style={styles.stickyButtonContainer}>
        <SubmitButton
          title="Complete Registration"
          onPress={handleFinish}
          isLoading={isRegistering}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.black,
  },
  scrollView: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    alignItems: "center",
  },
  gradientCard: {
    width: "100%",
    borderRadius: spacing.md,
    padding: spacing.lg,
    shadowColor: colors.neutral.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: spacing.sm,
  },
  headerContent: {
    alignItems: "center",
    marginBottom: Platform.OS === "ios" ? spacing.md : spacing.sm,
  },
  title: {
    color: colors.text.primary,
    textAlign: "center",
  },
  description: {
    color: colors.text.secondary,
    textAlign: "center",
    marginBottom: spacing.lg,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSizes.md,
    paddingHorizontal: spacing.sm,
  },
  summaryInnerContainer: {
    width: "100%",
    backgroundColor: "transparent",
    borderRadius: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  sectionLabel: {
    color: colors.text.secondary,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSizes.sm,
    width: 110,
    marginBottom: spacing.sm,
  },
  sectionValue: {
    color: colors.text.primary,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSizes.sm,
    textAlign: "left", 
  },
  optionGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    justifyContent: "flex-start", // changed from flex-end
  },
  optionButton: {
    backgroundColor: colors.neutral.black,
    borderRadius: spacing.xl,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.text.primary,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
    alignSelf: "flex-start", // ensure chip only takes as much width as needed
  },
  optionText: {
    color: colors.primary.yellow,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSizes.xs,
  },
  selectedOptionText: {
    color: colors.text.primary,
  },
  selectedOptionButtonGenericBorder: {
    borderColor: colors.text.primary,
  },
  selectedPreferenceText: {
    color: colors.text.primary,
  },
  stickyButtonContainer: {
    padding: spacing.lg,
    borderTopColor: colors.neutral.surface,
    backgroundColor: colors.neutral.black,
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    backgroundColor: "transparent",
  },
  editButtonText: {
    color: colors.primary.yellow,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSizes.sm,
    marginLeft: 4,
  },
  sectionLabelValueRow: {
    flex: 1,
    flexDirection: "column",
    gap: spacing.xs,
  },
  termsContainer: {
    width: "100%",
  },
  termsText: {
    color: colors.text.secondary,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSizes.sm,
    textAlign: "left",
  },
  termsLink: {
    color: colors.text.secondary,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSizes.sm,
    textDecorationLine: "underline",
  },
});
