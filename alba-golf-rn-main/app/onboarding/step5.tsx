import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, StyleSheet, Text, Animated, Easing, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SubmitButton, Heading } from "@/components/ui";
import { colors, spacing, typography } from "@/constants/theme";
import { router, useFocusEffect } from "expo-router";
import { CompactColourOptionButton } from "@/components/ui/CompactColourOptionButton";
import { useOnboardingStore } from "@/stores/onboardingStore";

export default function OnboardingStep5() {
  // Get state and actions from our store
  const { availability, setAvailability } = useOnboardingStore();

  // Local state for UI
  const [weekdayAvailability, setWeekdayAvailability] = useState<string[]>(
    availability.weekdays || []
  );
  const [weekendAvailability, setWeekendAvailability] = useState<string[]>(
    availability.weekends || []
  );

  // Animation values
  const headingOpacity = useRef(new Animated.Value(0)).current;
  const headingTranslateY = useRef(new Animated.Value(-20)).current;

  // Column animations
  const leftColumnOpacity = useRef(new Animated.Value(0)).current;
  const leftColumnTranslateX = useRef(new Animated.Value(-30)).current;

  const rightColumnOpacity = useRef(new Animated.Value(0)).current;
  const rightColumnTranslateX = useRef(new Animated.Value(30)).current;

  // Column title animations
  const weekdaysTitleOpacity = useRef(new Animated.Value(0)).current;
  const weekendsTitleOpacity = useRef(new Animated.Value(0)).current;

  // Weekday option animations
  const weekdayOptionOpacity = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  const weekdayOptionScale = useRef([
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
  ]).current;

  // Weekend option animations
  const weekendOptionOpacity = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  const weekendOptionScale = useRef([
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
  ]).current;

  // Button animation
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonTranslateY = useRef(new Animated.Value(30)).current;

  // Screen exit animations
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const screenScale = useRef(new Animated.Value(1)).current;

  // Start animations when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      // Reset animations to initial states before starting
      headingOpacity.setValue(0);
      headingTranslateY.setValue(-20);
      leftColumnOpacity.setValue(0);
      leftColumnTranslateX.setValue(-30);
      rightColumnOpacity.setValue(0);
      rightColumnTranslateX.setValue(30);
      weekdaysTitleOpacity.setValue(0);
      weekendsTitleOpacity.setValue(0);
      weekdayOptionOpacity.forEach((opacity) => opacity.setValue(0));
      weekdayOptionScale.forEach((scale) => scale.setValue(1));
      weekendOptionOpacity.forEach((opacity) => opacity.setValue(0));
      weekendOptionScale.forEach((scale) => scale.setValue(1));
      buttonOpacity.setValue(0);
      buttonTranslateY.setValue(30);
      screenOpacity.setValue(1);
      screenScale.setValue(1);

      // Heading animations
      const headingAnimation = Animated.timing(headingOpacity, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      });

      const headingTranslateAnimation = Animated.timing(headingTranslateY, {
        toValue: 0,
        duration: 600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      });

      // Column animations
      const leftColumnAnimation = Animated.parallel([
        Animated.timing(leftColumnOpacity, {
          toValue: 1,
          duration: 500,
          delay: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(leftColumnTranslateX, {
          toValue: 0,
          duration: 500,
          delay: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]);

      const rightColumnAnimation = Animated.parallel([
        Animated.timing(rightColumnOpacity, {
          toValue: 1,
          duration: 500,
          delay: 400,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(rightColumnTranslateX, {
          toValue: 0,
          duration: 500,
          delay: 400,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]);

      // Column title animations
      const weekdaysTitleAnimation = Animated.timing(weekdaysTitleOpacity, {
        toValue: 1,
        duration: 400,
        delay: 500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      });

      const weekendsTitleAnimation = Animated.timing(weekendsTitleOpacity, {
        toValue: 1,
        duration: 400,
        delay: 600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      });

      // Weekday option animations
      const weekdayOptionAnimations = weekdayOptionOpacity.map(
        (opacity, index) => {
          return Animated.timing(opacity, {
            toValue: 1,
            duration: 400,
            delay: 600 + index * 80,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          });
        }
      );

      // Weekend option animations
      const weekendOptionAnimations = weekendOptionOpacity.map(
        (opacity, index) => {
          return Animated.timing(opacity, {
            toValue: 1,
            duration: 400,
            delay: 700 + index * 80,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          });
        }
      );

      // Button animation
      const buttonAnimation = Animated.parallel([
        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 500,
          delay: 1100,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(buttonTranslateY, {
          toValue: 0,
          duration: 500,
          delay: 1100,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]);

      // Run all animations
      Animated.parallel([
        Animated.parallel([headingAnimation, headingTranslateAnimation]),
        leftColumnAnimation,
        rightColumnAnimation,
        weekdaysTitleAnimation,
        weekendsTitleAnimation,
        ...weekdayOptionAnimations,
        ...weekendOptionAnimations,
        buttonAnimation,
      ]).start();

      // Optional cleanup function
      // return () => {
      //   // Reset animations when screen loses focus if needed
      // };
    }, []) // Empty dependency array for focus/blur cycles
  );

  const getWeekdayOptionIndex = (option: string): number => {
    switch (option) {
      case "EARLY_MORNING":
        return 0;
      case "LATE_MORNING":
        return 1;
      case "LUNCH_TIME":
        return 2;
      case "LATE_AFTERNOON":
        return 3;
      case "EVENING":
        return 4;
      default:
        return -1;
    }
  };

  const getWeekendOptionIndex = (option: string): number => {
    switch (option) {
      case "EARLY_MORNING":
        return 0;
      case "LATE_MORNING":
        return 1;
      case "LUNCH_TIME":
        return 2;
      case "LATE_AFTERNOON":
        return 3;
      case "EVENING":   
        return 4;
      default:
        return -1;
    }
  };

  const handleWeekdayOptionPress = (option: string) => {
    setWeekdayAvailability((prev) => {
      const isSelected = prev.includes(option);
      const newAvailability = isSelected
        ? prev.filter((item) => item !== option)
        : [...prev, option];

      // Animate the selected option
      const selectedIndex = getWeekdayOptionIndex(option);
      if (selectedIndex >= 0) {
        Animated.sequence([
          Animated.timing(weekdayOptionScale[selectedIndex], {
            toValue: 1.05,
            duration: 100,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(weekdayOptionScale[selectedIndex], {
            toValue: 1,
            duration: 100,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]).start();
      }

      return newAvailability;
    });
  };

  const handleWeekendOptionPress = (option: string) => {
    setWeekendAvailability((prev) => {
      const isSelected = prev.includes(option);
      const newAvailability = isSelected
        ? prev.filter((item) => item !== option)
        : [...prev, option];

      // Animate the selected option
      const selectedIndex = getWeekendOptionIndex(option);
      if (selectedIndex >= 0) {
        Animated.sequence([
          Animated.timing(weekendOptionScale[selectedIndex], {
            toValue: 1.05,
            duration: 100,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(weekendOptionScale[selectedIndex], {
            toValue: 1,
            duration: 100,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]).start();
      }

      return newAvailability;
    });
  };

  const handleSubmit = () => {
    // Combine weekday and weekend availability and update store
    const availabilityData = {
      weekdays: weekdayAvailability,
      weekends: weekendAvailability,
    };

    setAvailability(availabilityData);

    // Animate out before navigation
    Animated.parallel([
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(screenScale, {
        toValue: 1.05,
        duration: 400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Navigate to the next step after animation completes
      router.push("/onboarding/step6");
    });
  };

  return (
    <Animated.View
      style={[
        styles.animatedContainer,
        {
          opacity: screenOpacity,
          transform: [{ scale: screenScale }],
        },
      ]}
    >
      <SafeAreaView style={styles.container} edges={["left", "right"]}>
        <View style={styles.formContainer}>
          {/* Header section */}
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
              When are you available to play?
            </Heading>
          </Animated.View>

          {/* Side-by-side columns for Weekday and Weekend */}
          <View style={styles.columnsContainer}>
            {/* Weekday column */}
            <Animated.View
              style={[
                styles.column,
                {
                  opacity: leftColumnOpacity,
                  transform: [{ translateX: leftColumnTranslateX }],
                },
              ]}
            >
              <Animated.Text
                style={[styles.sectionTitle, { opacity: weekdaysTitleOpacity }]}
              >
                Weekdays
              </Animated.Text>
              <View style={styles.optionsContainer}>
                <Animated.View
                  style={{
                    opacity: weekdayOptionOpacity[0],
                    transform: [{ scale: weekdayOptionScale[0] }],
                  }}
                >
                  <CompactColourOptionButton
                    title="Early Morning"
                    subtitle="(6am - 9am)"
                    selected={weekdayAvailability.includes("EARLY_MORNING")}
                    onPress={() => handleWeekdayOptionPress("EARLY_MORNING")}
                  />
                </Animated.View>
                <Animated.View
                  style={{
                    opacity: weekdayOptionOpacity[1],
                    transform: [{ scale: weekdayOptionScale[1] }],
                  }}
                >
                  <CompactColourOptionButton
                    title="Late Morning"
                    subtitle="(9am - 12pm)"
                    selected={weekdayAvailability.includes("LATE_MORNING")}
                    onPress={() => handleWeekdayOptionPress("LATE_MORNING")}
                  />
                </Animated.View>
                <Animated.View
                  style={{
                    opacity: weekdayOptionOpacity[2],
                    transform: [{ scale: weekdayOptionScale[2] }],
                  }}
                >
                  <CompactColourOptionButton
                    title="Lunch Time"
                    subtitle="(12pm - 3pm)"
                    selected={weekdayAvailability.includes("LUNCH_TIME")}
                    onPress={() => handleWeekdayOptionPress("LUNCH_TIME")}
                  />
                </Animated.View>
                <Animated.View
                  style={{
                    opacity: weekdayOptionOpacity[3],
                    transform: [{ scale: weekdayOptionScale[3] }],
                  }}
                >
                  <CompactColourOptionButton
                    title="Late Afternoon"
                    subtitle="(3pm - 6pm)"
                    selected={weekdayAvailability.includes("LATE_AFTERNOON")}
                    onPress={() => handleWeekdayOptionPress("LATE_AFTERNOON")}
                  />
                </Animated.View>
                <Animated.View
                  style={{
                    opacity: weekdayOptionOpacity[4],
                    transform: [{ scale: weekdayOptionScale[4] }],
                  }}
                >
                  <CompactColourOptionButton
                    title="Evening"
                    subtitle="(After 6pm)"
                    selected={weekdayAvailability.includes("EVENING")}
                    onPress={() => handleWeekdayOptionPress("EVENING")}
                  />
                </Animated.View>
              </View>
            </Animated.View>

            {/* Weekend column */}
            <Animated.View
              style={[
                styles.column,
                {
                  opacity: rightColumnOpacity,
                  transform: [{ translateX: rightColumnTranslateX }],
                },
              ]}
            >
              <Animated.Text
                style={[styles.sectionTitle, { opacity: weekendsTitleOpacity }]}
              >
                Weekends
              </Animated.Text>
              <View style={styles.optionsContainer}>
                <Animated.View
                  style={{
                    opacity: weekendOptionOpacity[0],
                    transform: [{ scale: weekendOptionScale[0] }],
                  }}
                >
                  <CompactColourOptionButton
                    title="Early Morning"
                    subtitle="(6am - 9am)"
                    selected={weekendAvailability.includes("EARLY_MORNING")}
                    onPress={() => handleWeekendOptionPress("EARLY_MORNING")}
                  />
                </Animated.View>
                <Animated.View
                  style={{
                    opacity: weekendOptionOpacity[1],
                    transform: [{ scale: weekendOptionScale[1] }],
                  }}
                >
                  <CompactColourOptionButton
                    title="Late Morning"
                    subtitle="(9am - 12pm)"
                    selected={weekendAvailability.includes("LATE_MORNING")}
                    onPress={() => handleWeekendOptionPress("LATE_MORNING")}
                  />
                </Animated.View>
                <Animated.View
                  style={{
                    opacity: weekendOptionOpacity[2],
                    transform: [{ scale: weekendOptionScale[2] }],
                  }}
                >
                  <CompactColourOptionButton
                    title="Lunch Time"
                    subtitle="(12pm - 3pm)"
                    selected={weekendAvailability.includes("LUNCH_TIME")}
                    onPress={() => handleWeekendOptionPress("LUNCH_TIME")}
                  />
                </Animated.View>
                <Animated.View
                  style={{
                    opacity: weekendOptionOpacity[3],
                    transform: [{ scale: weekendOptionScale[3] }],
                  }}
                >
                  <CompactColourOptionButton
                    title="Late Afternoon"
                    subtitle="(3pm - 6pm)"
                    selected={weekendAvailability.includes("LATE_AFTERNOON")}
                    onPress={() => handleWeekendOptionPress("LATE_AFTERNOON")}
                  />
                </Animated.View>
                <Animated.View
                  style={{
                    opacity: weekendOptionOpacity[4],
                    transform: [{ scale: weekendOptionScale[4] }],
                  }}
                >
                  <CompactColourOptionButton
                    title="Evening"
                    subtitle="(After 6pm)"
                    selected={weekendAvailability.includes("EVENING")}
                    onPress={() => handleWeekendOptionPress("EVENING")}
                  />
                </Animated.View>
              </View>
            </Animated.View>
          </View>

          {/* Button section */}
          <Animated.View
            style={[
              styles.buttonSection,
              {
                opacity: buttonOpacity,
                transform: [{ translateY: buttonTranslateY }],
              },
            ]}
          >
            <SubmitButton title="Continue" onPress={handleSubmit} />
          </Animated.View>
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  animatedContainer: {
    flex: 1,
    backgroundColor: colors.neutral.black,
  },
  container: {
    flex: 1,
    backgroundColor: colors.neutral.black,
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  headerSection: {
    alignItems: "center",
    marginBottom: spacing.lg,
    paddingTop: spacing.md,
  },
  columnsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    flex: 1,
    paddingTop: spacing.xs,
  },
  column: {
    width: "48%", // Slightly less than 50% to ensure spacing between columns
  },
  sectionTitle: {
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.medium,
    color: colors.text.primary,
    marginBottom: Platform.OS === "ios" ? spacing.md : spacing.sm,
    textAlign: "center",
  },
  optionsContainer: {
    gap: Platform.OS === "ios" ? spacing.md : spacing.sm,
  },
  buttonSection: {
    marginTop: spacing.sm,
    paddingBottom: spacing.md,
  },
});
