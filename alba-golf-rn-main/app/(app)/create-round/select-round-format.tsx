import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  Animated,
  Easing,
  Text,
  TouchableOpacity,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Heading, StandardOptionButton } from "@/components/ui";
import { colors, spacing, typography } from "@/constants/theme";
import { router, useFocusEffect } from "expo-router";
import { useCreateGameStore } from "@/stores/createGameStore";
import { Ionicons } from "@expo/vector-icons";

// Corresponds to GameFormat enum from Prisma schema
const GAME_FORMAT_OPTIONS = [
  {
    id: "MATCHPLAY",
    title: "Matchplay",
    subtitle: "Win the most holes to win the match",
  },
  {
    id: "STROKEPLAY",
    title: "Strokeplay",
    subtitle: "Total up all strokes - lowest overall score wins",
  },
  {
    id: "SCRAMBLE",
    title: "Scramble",
    subtitle: "Partners hit, then play from the best shot position",
  },
  {
    id: "STABLEFORD",
    title: "Stableford",
    subtitle: "Score points for your performance on each hole",
  },
  {
    id: "BEST_BALL",
    title: "Best Ball",
    subtitle: "Partners play own balls - best score counts",
  },
];

export default function SelectGameFormatScreen() {
  const { gameFormat, setGameFormat, selectedCourse, courseLocked } =
    useCreateGameStore();
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(
    gameFormat
  );

  // Animation values
  const headingOpacity = useRef(new Animated.Value(0)).current;
  const headingTranslateY = useRef(new Animated.Value(-20)).current;

  const optionsOpacity = useRef(
    GAME_FORMAT_OPTIONS.map(() => new Animated.Value(0))
  ).current;
  const optionsTranslateX = useRef(
    GAME_FORMAT_OPTIONS.map(() => new Animated.Value(-30))
  ).current;
  const optionsScale = useRef(
    GAME_FORMAT_OPTIONS.map(() => new Animated.Value(1))
  ).current;

  // Animation for "Decide Later" link
  const decideLaterOpacity = useRef(new Animated.Value(0)).current;
  const decideLaterTranslateY = useRef(new Animated.Value(20)).current;

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
      decideLaterOpacity.setValue(0);
      decideLaterTranslateY.setValue(20);
      screenOpacity.setValue(1);
      screenScale.setValue(1);

      const animations = [
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
        Animated.timing(decideLaterOpacity, {
          toValue: 1,
          duration: 500,
          delay: 300 + GAME_FORMAT_OPTIONS.length * 100,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(decideLaterTranslateY, {
          toValue: 0,
          duration: 500,
          delay: 300 + GAME_FORMAT_OPTIONS.length * 100,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ];

      Animated.parallel(animations).start();
    }, [])
  );

  const handleOptionPress = (optionId: string) => {
    setSelectedOptionId(optionId);
    setGameFormat(optionId);

    const selectedIndex = GAME_FORMAT_OPTIONS.findIndex(
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
        const nextPath =
          courseLocked && selectedCourse
            ? "/create-round/review-round-details"
            : "/create-round/select-course";
        router.push(nextPath as any);
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
          <View>
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
                Which match format?
              </Heading>
            </Animated.View>

            <View style={styles.inputSection}>
              {GAME_FORMAT_OPTIONS.map((option, index) => (
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
                  <StandardOptionButton
                    title={option.title}
                    subtitle={option.subtitle}
                    onPress={() => handleOptionPress(option.id)}
                  />
                </Animated.View>
              ))}
            </View>
          </View>

          <Animated.View
            style={[
              styles.decideLaterContainer,
              {
                opacity: decideLaterOpacity,
                transform: [{ translateY: decideLaterTranslateY }],
              },
            ]}
          >
            <TouchableOpacity
              style={styles.decideLaterButton}
              onPress={() => handleOptionPress("DONT_KNOW_YET")}
            >
              <Text style={styles.decideLaterText}>Decide Later</Text>
              <Ionicons
                name="arrow-forward"
                size={20}
                color={colors.primary.yellow}
              />
            </TouchableOpacity>
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
    paddingBottom: spacing.xl,
    paddingTop: spacing.md,
    justifyContent: "space-between",
  },
  headerSection: {
    alignItems: "center",
    marginBottom: spacing.md,
    paddingTop: Platform.OS === "ios" ? spacing.md : spacing.sm,
  },
  inputSection: {
    gap: spacing.md,
  },
  decideLaterContainer: {
    alignItems: "flex-end",
    paddingBottom: spacing.sm,
  },
  decideLaterButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Platform.OS === "ios" ? spacing.sm : spacing.md,
  },
  decideLaterText: {
    color: colors.primary.yellow,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.medium,
    marginRight: spacing.sm,
  },
});
