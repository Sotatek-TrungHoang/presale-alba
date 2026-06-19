import { View, StyleSheet, Animated, Easing } from "react-native";
import { colors, spacing } from "@/constants/theme";
import { Heading } from "@/components/ui/Heading";
import { StandardOptionButton } from "@/components/ui/StandardOptionButton";
import { useFocusEffect, router } from "expo-router";
import React, { useRef, useCallback } from "react";
import { useCreateGameStore } from "@/stores/createGameStore";

export default function CreateGameIndex() {
  // Animation values
  const headingOpacity = useRef(new Animated.Value(0)).current;
  const headingTranslateY = useRef(new Animated.Value(-20)).current;

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

  // Added for selection and exit animations
  const optionsScale = useRef([
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
  ]).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const screenScale = useRef(new Animated.Value(1)).current;

  // Get setPlayersNeeded from the store
  const setPlayersNeeded = useCreateGameStore(
    (state) => state.setPlayersNeeded
  );

  // Start animations when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      // Reset animations to initial states before starting
      headingOpacity.setValue(0);
      headingTranslateY.setValue(-20);
      optionsOpacity.forEach((opacity) => opacity.setValue(0));
      optionsTranslateX.forEach((translateX) => translateX.setValue(-30));
      optionsScale.forEach((scale) => scale.setValue(1)); // Reset scale
      screenOpacity.setValue(1); // Reset screen exit animations
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
    }, []) // Empty dependency array for focus/blur cycles
  );

  const handlePlayersSelected = (numPlayers: number, index: number) => {
    setPlayersNeeded(numPlayers);

    // Pulse animation for the selected button
    Animated.sequence([
      Animated.timing(optionsScale[index], {
        toValue: 1.05,
        duration: 150,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(optionsScale[index], {
        toValue: 1,
        duration: 150,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();

    // Delay and then animate screen out before navigation
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(screenOpacity, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(screenScale, {
          toValue: 1.05, // Or 0.95 for a shrink effect
          duration: 400,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(() => {
        router.push("/create-round/select-time-slot");
      });
    }, 300); // Delay to show selection animation and allow pulse to complete
  };

  return (
    <Animated.View
      style={[
        styles.outermostContainer, // Use a new style for the outermost Animated.View
        {
          opacity: screenOpacity,
          transform: [{ scale: screenScale }],
        },
      ]}
    >
      <View style={styles.container}>
        <View style={styles.formContainer}>
          <Animated.View
            style={[
              styles.headerSection,
              {
                opacity: headingOpacity,
                transform: [{ translateY: headingTranslateY }],
              },
            ]}
          >
            <Heading level={2} weight="light">
              How Many Players?
            </Heading>
          </Animated.View>
          <View style={styles.inputSection}>
            <Animated.View
              style={{
                opacity: optionsOpacity[0],
                transform: [
                  { translateX: optionsTranslateX[0] },
                  { scale: optionsScale[0] }, // Apply scale animation
                ],
              }}
            >
              <StandardOptionButton
                title="2 Players"
                subtitle="Perfect for Matchplay or Strokeplay"
                onPress={() => handlePlayersSelected(2, 0)} // Pass index
              />
            </Animated.View>
            <Animated.View
              style={{
                opacity: optionsOpacity[1],
                transform: [
                  { translateX: optionsTranslateX[1] },
                  { scale: optionsScale[1] }, // Apply scale animation
                ],
              }}
            >
              <StandardOptionButton
                title="3 Players"
                subtitle="Perfect for Stableford or Strokeplay"
                onPress={() => handlePlayersSelected(3, 1)} // Pass index
              />
            </Animated.View>
            <Animated.View
              style={{
                opacity: optionsOpacity[2],
                transform: [
                  { translateX: optionsTranslateX[2] },
                  { scale: optionsScale[2] }, // Apply scale animation
                ],
              }}
            >
              <StandardOptionButton
                title="4 Players"
                subtitle="Ideal for Best Ball, Scramble, or any format"
                onPress={() => handlePlayersSelected(4, 2)} // Pass index
              />
            </Animated.View>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outermostContainer: {
    // Style for the new outermost Animated.View
    flex: 1,
    backgroundColor: colors.neutral.black, // Ensure background is consistent
  },
  container: {
    flex: 1,
    // backgroundColor: colors.neutral.black, // Moved to outermostContainer
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    justifyContent: "center",
  },
  headerSection: {
    alignItems: "center",
    marginBottom: spacing.md,
    paddingTop: spacing.md,
  },
  headerText: {
    color: colors.text.primary,
  },
  inputSection: {
    marginTop: spacing.sm,
    gap: spacing.lg,
  },
});
