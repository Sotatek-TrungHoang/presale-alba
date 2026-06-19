import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, StyleSheet, Animated, Easing } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Heading, ColourOptionButton } from "@/components/ui";
import { colors, spacing } from "@/constants/theme";
import { router, useFocusEffect } from "expo-router";
import { useCreateGameStore } from "@/stores/createGameStore";

// Corresponds to GameType enum from Prisma schema
const GAME_TYPE_OPTIONS = [
  {
    id: "BEGINNER_FRIENDLY",
    title: "Beginner Friendly",
    subtitle: "A slower-paced round with time to learn the basics",
    colour: "yellow",
  },
  {
    id: "PURELY_SOCIAL",
    title: "Purely Social",
    subtitle: "Just golf and good company",
    colour: "orange",
  },
  // {
  //   id: "RELAXED_ROUND",
  //   title: "Relaxed Round",
  //   subtitle: "Keeping score but at a casual pace and spirit",
  //   colour: "orange",
  // },
  {
    id: "COMPETITIVE_MATCH",
    title: "Competitive Match",
    subtitle: "Full scoring and rules for a proper competitive game",
    colour: "red",
  },
  
];

export default function SelectGameTypeScreen() {
  const { gameType, setGameType } = useCreateGameStore();
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(
    gameType
  );

  // Animation values
  const headingOpacity = useRef(new Animated.Value(0)).current;
  const headingTranslateY = useRef(new Animated.Value(-20)).current;

  const optionsOpacity = useRef(
    GAME_TYPE_OPTIONS.map(() => new Animated.Value(0))
  ).current;
  const optionsTranslateX = useRef(
    GAME_TYPE_OPTIONS.map(() => new Animated.Value(-30))
  ).current;
  const optionsScale = useRef(
    GAME_TYPE_OPTIONS.map(() => new Animated.Value(1))
  ).current;

  // Screen exit animations
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const screenScale = useRef(new Animated.Value(1)).current;

  useFocusEffect(
    useCallback(() => {
      // Reset animations
      headingOpacity.setValue(0);
      headingTranslateY.setValue(-20);
      optionsOpacity.forEach((op) => op.setValue(0));
      optionsTranslateX.forEach((tx) => tx.setValue(-30));
      optionsScale.forEach((s) => s.setValue(1));
      screenOpacity.setValue(1);
      screenScale.setValue(1);

      Animated.parallel([
        Animated.timing(headingOpacity, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(headingTranslateY, {
          toValue: 0,
          duration: 600,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        ...optionsOpacity.map((opacity, index) =>
          Animated.timing(opacity, {
            toValue: 1,
            duration: 500,
            delay: 300 + index * 100,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          })
        ),
        ...optionsTranslateX.map((translateX, index) =>
          Animated.timing(translateX, {
            toValue: 0,
            duration: 500,
            delay: 300 + index * 100,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          })
        ),
      ]).start();
    }, [])
  );

  const handleOptionPress = (optionId: string) => {
    setSelectedOptionId(optionId);
    setGameType(optionId);

    const selectedIndex = GAME_TYPE_OPTIONS.findIndex(
      (opt) => opt.id === optionId
    );

    if (selectedIndex !== -1) {
      Animated.sequence([
        Animated.timing(optionsScale[selectedIndex], {
          toValue: 1.05,
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
        router.push("/create-round/select-round-format");
      });
    }, 300);
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
              What type of round?
            </Heading>
          </Animated.View>

          <View style={styles.inputSection}>
            {GAME_TYPE_OPTIONS.map((option, index) => (
              <Animated.View
                key={option.id}
                style={{
                  opacity: optionsOpacity[index],
                  transform: [
                    { translateX: optionsTranslateX[index] },
                    { scale: optionsScale[index] },
                  ],
                }}
              >
                <ColourOptionButton
                  title={option.title}
                  subtitle={option.subtitle}
                  colour={option.colour as any}
                  selected={selectedOptionId === option.id}
                  onPress={() => handleOptionPress(option.id)}
                />
              </Animated.View>
            ))}
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
  formContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.md,
    justifyContent: "center",
  },
  headerSection: {
    alignItems: "center",
    marginBottom: spacing.xl,
    paddingTop: spacing.md,
  },
  inputSection: {
    gap: spacing.lg,
  },
});
