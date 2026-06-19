import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Text,
  Animated,
  Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SubmitButton, Heading } from "@/components/ui";
import { colors, spacing, typography } from "@/constants/theme";
import { router, useFocusEffect } from "expo-router";
import { ColourOptionButton } from "@/components/ui/ColourOptionButton";
import { useOnboardingStore } from "@/stores/onboardingStore";

export default function OnboardingStep4() {
  // Get state and actions from our store
  const { matchTypes, setMatchTypes } = useOnboardingStore();

  // Local state for UI management
  const [localMatchTypes, setLocalMatchTypes] = useState<string[]>(matchTypes);

  // Animation values
  const headingOpacity = useRef(new Animated.Value(0)).current;
  const headingTranslateY = useRef(new Animated.Value(-20)).current;

  const subheadingOpacity = useRef(new Animated.Value(0)).current;

  // Animation values for each option button
  const optionsOpacity = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  const optionsTranslateX = useRef([
    new Animated.Value(-30),
    new Animated.Value(-30),
    new Animated.Value(-30),
  ]).current;

  // Animation for the option that gets selected
  const optionsScale = useRef([
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
  ]).current;

  // Animation for the button
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonTranslateY = useRef(new Animated.Value(30)).current;

  // Animation for the entire screen on exit
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const screenScale = useRef(new Animated.Value(1)).current;

  // Start animations when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      // Reset animations to initial states before starting
      headingOpacity.setValue(0);
      headingTranslateY.setValue(-20);
      subheadingOpacity.setValue(0);
      optionsOpacity.forEach((opacity) => opacity.setValue(0));
      optionsTranslateX.forEach((translateX) => translateX.setValue(-30));
      optionsScale.forEach((scale) => scale.setValue(1)); // Reset scale used on selection
      buttonOpacity.setValue(0);
      buttonTranslateY.setValue(30);
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

      // Subheading animation
      const subheadingAnimation = Animated.timing(subheadingOpacity, {
        toValue: 1,
        duration: 600,
        delay: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      });

      // Create staggered animations for option buttons
      const optionAnimations = optionsOpacity.map((opacity, index) => {
        return Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 500,
            delay: 400 + index * 100, // Stagger effect
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(optionsTranslateX[index], {
            toValue: 0,
            duration: 500,
            delay: 400 + index * 100, // Stagger effect
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]);
      });

      // Button animation
      const buttonAnimation = Animated.parallel([
        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 500,
          delay: 800,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(buttonTranslateY, {
          toValue: 0,
          duration: 500,
          delay: 800,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]);

      // Run all animations
      Animated.parallel([
        Animated.parallel([headingAnimation, headingTranslateAnimation]),
        subheadingAnimation,
        ...optionAnimations,
        buttonAnimation,
      ]).start();

      // Optional cleanup function
      // return () => {
      //   // Reset animations when screen loses focus if needed
      // };
    }, []) // Empty dependency array for focus/blur cycles
  );

  const getOptionIndex = (option: string): number => {
    switch (option) {
      case "BEGINNER FRIENDLY":
        return 0;
      case "SOCIAL":
        return 1;
      case "COMPETITIVE MATCHES":
        return 2;
      default:
        return -1;
    }
  };

  const handleOptionPress = (option: string) => {
    setLocalMatchTypes((prev) => {
      const isSelected = prev.includes(option);
      const newMatchTypes = isSelected
        ? prev.filter((item) => item !== option)
        : [...prev, option];

      // Get index of the option
      const selectedIndex = getOptionIndex(option);

      // Animate the option that was clicked
      if (selectedIndex >= 0) {
        // Pulse animation for the selected button
        Animated.sequence([
          Animated.timing(optionsScale[selectedIndex], {
            toValue: 1.05,
            duration: 100,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(optionsScale[selectedIndex], {
            toValue: 1,
            duration: 100,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]).start();
      }

      return newMatchTypes;
    });
  };

  const handleSubmit = () => {
    // Update the store with selected match types
    setMatchTypes(localMatchTypes);

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
      router.push("/onboarding/step7");
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
                What are you looking for?
              </Heading>
              <Animated.Text
                style={[styles.subheading, { opacity: subheadingOpacity }]}
              >
                Pick the rounds that feel most ‘you’.
              </Animated.Text>
              <Animated.Text
                style={[styles.subheading, { opacity: subheadingOpacity }]}
              >
                You can change this later
              </Animated.Text>
            </Animated.View>

            <View style={styles.inputSection}>
              {/* Beginner Friendly */}
              <Animated.View
                style={{
                  opacity: optionsOpacity[0],
                  transform: [
                    { translateX: optionsTranslateX[0] },
                    { scale: optionsScale[0] },
                  ],
                }}
              >
                <ColourOptionButton
                  title="Beginner Friendly"
                  subtitle="Take it slow, learn as you go"
                  colour="yellow"
                  selected={localMatchTypes.includes("BEGINNER FRIENDLY")}
                  onPress={() => handleOptionPress("BEGINNER FRIENDLY")}
                />
              </Animated.View>

              {/* Social - No Scoring */}
              <Animated.View
                style={{
                  opacity: optionsOpacity[1],
                  transform: [
                    { translateX: optionsTranslateX[1] },
                    { scale: optionsScale[1] },
                  ],
                }}
              >
                <ColourOptionButton
                  title="Social - No Scoring"
                  subtitle="Just golf and good company"
                  colour="orange"
                  selected={localMatchTypes.includes("SOCIAL")}
                  onPress={() => handleOptionPress("SOCIAL")}
                />
              </Animated.View>

              {/* Competitive Matches */}
              <Animated.View
                style={{
                  opacity: optionsOpacity[2],
                  transform: [
                    { translateX: optionsTranslateX[2] },
                    { scale: optionsScale[2] },
                  ],
                }}
              >
                <ColourOptionButton
                  title="Competitive Matches"
                  subtitle="Play by the rules, full scoring"
                  colour="red"
                  selected={localMatchTypes.includes("COMPETITIVE MATCHES")}
                  onPress={() => handleOptionPress("COMPETITIVE MATCHES")}
                />
              </Animated.View>
            </View>
          </View>
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
    marginTop: 0,
  },
  headerSection: {
    alignItems: "center",
    marginBottom: spacing.md,
    paddingTop: spacing.md,
  },
  inputSection: {
    marginTop: spacing.sm,
    gap: Platform.OS === "ios" ? spacing.lg : spacing.sm,
  },
  buttonSection: {
    paddingBottom: spacing.xl,
  },
  subheading: {
    fontSize: typography.fontSizes.sm,
    color: colors.text.secondary,
  },
});
