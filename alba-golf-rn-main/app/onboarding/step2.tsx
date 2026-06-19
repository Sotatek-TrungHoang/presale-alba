import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, StyleSheet, Animated, Easing } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Heading, StandardOptionButton } from "@/components/ui";
import { colors, spacing } from "@/constants/theme";
import { router, useFocusEffect } from "expo-router";
import { useOnboardingStore } from "@/stores/onboardingStore";

export default function OnboardingStep2() {
  // Get state and actions from our store
  const { handicap, setHandicap } = useOnboardingStore();
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  // Animation values
  const headingOpacity = useRef(new Animated.Value(0)).current;
  const headingTranslateY = useRef(new Animated.Value(-20)).current;

  // Animation values for each option button
  const optionsOpacity = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  const optionsTranslateX = useRef([
    new Animated.Value(-30),
    new Animated.Value(-30),
    new Animated.Value(-30),
    new Animated.Value(-30),
  ]).current;

  // Animation for the option that gets selected
  const optionsScale = useRef([
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
  ]).current;

  // Animation for the entire screen on exit
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const screenScale = useRef(new Animated.Value(1)).current;

  // Start animations when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      // Reset animations to initial states before starting
      headingOpacity.setValue(0);
      headingTranslateY.setValue(-20);
      optionsOpacity.forEach((opacity) => opacity.setValue(0));
      optionsTranslateX.forEach((translateX) => translateX.setValue(-30));
      optionsScale.forEach((scale) => scale.setValue(1)); // Reset scale used on selection
      screenOpacity.setValue(1);
      screenScale.setValue(1);

      // Create sequence for heading
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

      // Create staggered animations for option buttons
      const optionAnimations = optionsOpacity.map((opacity, index) => {
        return Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 500,
            delay: 300 + index * 100, // Stagger effect
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(optionsTranslateX[index], {
            toValue: 0,
            duration: 500,
            delay: 300 + index * 100, // Stagger effect
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]);
      });

      // Run animations
      Animated.parallel([
        Animated.parallel([headingAnimation, headingTranslateAnimation]),
        ...optionAnimations,
      ]).start();

      // Optional cleanup function
      // return () => {
      //   // Reset animations when screen loses focus if needed
      // };
    }, []) // Empty dependency array for focus/blur cycles
  );

  const getOptionIndex = (option: string): number => {
    switch (option) {
      case "LOW":
        return 0;
      case "MID":
        return 1;
      case "HIGH":
        return 2;
      case "UNKNOWN":
        return 3;
      default:
        return -1;
    }
  };

  const handleOptionPress = (option: string) => {
    // Save which option was selected
    setSelectedOption(option);

    // Update the handicap in the store
    setHandicap(option);

    // Get index of selected option
    const selectedIndex = getOptionIndex(option);

    // First animate the selected option
    if (selectedIndex >= 0) {
      // Pulse animation for the selected button
      Animated.sequence([
        Animated.timing(optionsScale[selectedIndex], {
          toValue: 1.1,
          duration: 150,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(optionsScale[selectedIndex], {
          toValue: 1,
          duration: 150,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    }

    // Then after a short delay, animate out the entire screen
    setTimeout(() => {
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
        router.push("/onboarding/step3");
      });
    }, 300); // Small delay to show the option highlight effect
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
          {/* Header and Inputs positioned at the top */}
          <View style={styles.topSection}>
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
                What's your handicap?
              </Heading>
            </Animated.View>

            <View style={styles.inputSection}>
              {/* Low handicap */}
              <Animated.View
                style={{
                  opacity: optionsOpacity[0],
                  transform: [
                    { translateX: optionsTranslateX[0] },
                    { scale: optionsScale[0] },
                  ],
                }}
              >
                <StandardOptionButton
                  title="Low"
                  subtitle="(0-15)"
                  onPress={() => handleOptionPress("LOW")}
                />
              </Animated.View>

              {/* Mid handicap */}
              <Animated.View
                style={{
                  opacity: optionsOpacity[1],
                  transform: [
                    { translateX: optionsTranslateX[1] },
                    { scale: optionsScale[1] },
                  ],
                }}
              >
                <StandardOptionButton
                  title="Mid"
                  subtitle="(16-26)"
                  onPress={() => handleOptionPress("MID")}
                />
              </Animated.View>

              {/* High handicap */}
              <Animated.View
                style={{
                  opacity: optionsOpacity[2],
                  transform: [
                    { translateX: optionsTranslateX[2] },
                    { scale: optionsScale[2] },
                  ],
                }}
              >
                <StandardOptionButton
                  title="High"
                  subtitle="(27+)"
                  onPress={() => handleOptionPress("HIGH")}
                />
              </Animated.View>

              {/* Not Sure option */}
              <Animated.View
                style={{
                  opacity: optionsOpacity[3],
                  transform: [
                    { translateX: optionsTranslateX[3] },
                    { scale: optionsScale[3] },
                  ],
                }}
              >
                <StandardOptionButton
                  title="New to Golf"
                  subtitle="Not sure yet"
                  onPress={() => handleOptionPress("UNKNOWN")}
                />
              </Animated.View>
            </View>
          </View>
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
  keyboardAvoidingView: {
    flex: 1,
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    justifyContent: "space-between",
  },
  topSection: {
    // Top section contains header and inputs
    marginTop: 0,
  },
  headerSection: {
    alignItems: "center",
    marginBottom: spacing.md,
    paddingTop: spacing.md,
  },
  inputSection: {
    marginTop: spacing.sm,
    gap: spacing.lg,
  },
  buttonSection: {
    paddingBottom: spacing.xl,
  },
});
