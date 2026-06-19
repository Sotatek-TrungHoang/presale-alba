import React, { useState, useRef, useCallback } from "react";
import { View, StyleSheet, Animated, Easing, ScrollView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Heading, CompactColourOptionButton } from "@/components/ui";
import { colors, spacing } from "@/constants/theme";
import { router, useFocusEffect } from "expo-router";
import { useCreateGameStore } from "@/stores/createGameStore";
import { DateCircleButton } from "@/components/ui/DateCircleButton";

const TIME_SLOT_OPTIONS = [
  {
    id: "EARLY_MORNING",
    title: "Early Morning",
    subtitle: "(6am - 9am)",
  },
  {
    id: "LATE_MORNING",
    title: "Late Morning",
    subtitle: "(9am - 12pm)",
  },
  {
    id: "LUNCHTIME",
    title: "Lunch Time",
    subtitle: "(12pm - 3pm)",
  },
  {
    id: "LATE_AFTERNOON",
    title: "Late Afternoon",
    subtitle: "(3pm - 6pm)",
  },
  {
    id: "EVENING",
    title: "Evening",
    subtitle: "(After 6pm)",
  },
];

// Generate next 30 days for the date carousel
const generateDateOptions = () => {
  const dates = [];
  const today = new Date();
  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    dates.push({
      date,
      dayName: date
        .toLocaleString("default", { weekday: "short" })
        .toUpperCase(),
    });
  }
  return dates;
};

const DATE_OPTIONS = generateDateOptions();

export default function SelectTimeSlotScreen() {
  const { timeSlot, setTimeSlot, selectedDate, setSelectedDate } =
    useCreateGameStore();
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(
    timeSlot
  );
  const [selectedDateIndex, setSelectedDateIndex] = useState<number | null>(
    () => {
      // Initialize selectedDateIndex based on the store's selectedDate
      if (selectedDate) {
        const initialIndex = DATE_OPTIONS.findIndex(
          (option) => option.date.getTime() === selectedDate
        );
        return initialIndex !== -1 ? initialIndex : null;
      }
      return null;
    }
  );

  // Animation values
  const headingOpacity = useRef(new Animated.Value(0)).current;
  const headingTranslateY = useRef(new Animated.Value(-20)).current;

  const dateCarouselOpacity = useRef(new Animated.Value(0)).current;
  const dateCarouselTranslateY = useRef(new Animated.Value(-20)).current;

  const optionsOpacity = useRef(
    TIME_SLOT_OPTIONS.map(() => new Animated.Value(0))
  ).current;
  const optionsTranslateX = useRef(
    TIME_SLOT_OPTIONS.map(() => new Animated.Value(-30))
  ).current;
  const optionsScale = useRef(
    TIME_SLOT_OPTIONS.map(() => new Animated.Value(1))
  ).current;

  // Screen exit animations
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const screenScale = useRef(new Animated.Value(1)).current;

  useFocusEffect(
    useCallback(() => {
      // Reset animations
      headingOpacity.setValue(0);
      headingTranslateY.setValue(-20);
      dateCarouselOpacity.setValue(0);
      dateCarouselTranslateY.setValue(-20);
      // Ensure options are reset before deciding to animate them in
      optionsOpacity.forEach((op) => op.setValue(0));
      optionsTranslateX.forEach((tx) => tx.setValue(-30));
      optionsScale.forEach((s) => s.setValue(1)); // Reset scale too
      screenOpacity.setValue(1);
      screenScale.setValue(1);

      // Initial animations (heading and date carousel) - always run on focus
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
        Animated.timing(dateCarouselOpacity, {
          toValue: 1,
          duration: 600,
          delay: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(dateCarouselTranslateY, {
          toValue: 0,
          duration: 600,
          delay: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();

      // Check current selected date from store when screen focuses
      const currentSelectedDateInStore =
        useCreateGameStore.getState().selectedDate;
      let initialIndexToSync = -1;
      if (currentSelectedDateInStore) {
        initialIndexToSync = DATE_OPTIONS.findIndex(
          (option) => option.date.getTime() === currentSelectedDateInStore
        );
      }

      // Sync local state for selectedDateIndex with the store value
      // This ensures the correct date circle is highlighted
      const newSelectedDateIndex =
        initialIndexToSync !== -1 ? initialIndexToSync : null;
      if (selectedDateIndex !== newSelectedDateIndex) {
        setSelectedDateIndex(newSelectedDateIndex);
      }

      // If a date is found in the store (now reflected in newSelectedDateIndex),
      // animate in the time slots.
      if (newSelectedDateIndex !== null) {
        Animated.parallel([
          ...optionsOpacity.map((opacity, idx) =>
            Animated.timing(opacity, {
              toValue: 1,
              duration: 500,
              delay: 400 + idx * 100, // Delay to start after date carousel
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            })
          ),
          ...optionsTranslateX.map((translateX, idx) =>
            Animated.timing(translateX, {
              toValue: 0,
              duration: 500,
              delay: 400 + idx * 100,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            })
          ),
        ]).start();
      }
      // If newSelectedDateIndex is null, options remain in their reset (hidden) state.
    }, []) // Empty dependency array ensures this runs only on focus/blur
  );

  const handleDatePress = (index: number) => {
    const previouslySelectedThisSession = selectedDateIndex !== null;
    setSelectedDateIndex(index);
    setSelectedDate(DATE_OPTIONS[index].date.getTime());

    if (!previouslySelectedThisSession) {
      // Animate in time slots only if no date was previously selected in this session
      Animated.parallel([
        ...optionsOpacity.map((opacity, idx) =>
          Animated.timing(opacity, {
            toValue: 1,
            duration: 500,
            delay: 400 + idx * 100, // Delay to start after date carousel
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          })
        ),
        ...optionsTranslateX.map((translateX, idx) =>
          Animated.timing(translateX, {
            toValue: 0,
            duration: 500,
            delay: 400 + idx * 100,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          })
        ),
      ]).start();
    }
  };

  const handleOptionPress = (optionId: string) => {
    if (selectedDateIndex === null) {
      // Ensure date is selected
      // Show some feedback that date needs to be selected first
      // (e.g., Alert.alert or a visual cue)
      return;
    }

    setSelectedOptionId(optionId);
    setTimeSlot(optionId);

    const selectedIndex = TIME_SLOT_OPTIONS.findIndex(
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
        router.push("/create-round/select-round-type");
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
              When do you want to tee off?
            </Heading>
          </Animated.View>

          <Animated.View
            style={[
              styles.dateCarouselSection,
              {
                opacity: dateCarouselOpacity,
                transform: [{ translateY: dateCarouselTranslateY }],
              },
            ]}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dateCarouselContent}
            >
              {DATE_OPTIONS.map((dateOption, index) => (
                <View key={index} style={styles.dateCircleContainer}>
                  <DateCircleButton
                    date={dateOption.date}
                    dayName={dateOption.dayName}
                    selected={selectedDateIndex === index}
                    onPress={() => handleDatePress(index)}
                  />
                </View>
              ))}
            </ScrollView>
          </Animated.View>

          {selectedDateIndex !== null && (
            <View style={styles.inputSection}>
              {TIME_SLOT_OPTIONS.map((option, index) => (
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
                  <CompactColourOptionButton
                    title={option.title}
                    subtitle={option.subtitle}
                    selected={selectedOptionId === option.id}
                    onPress={() => handleOptionPress(option.id)}
                  />
                </Animated.View>
              ))}
            </View>
          )}
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
    paddingTop: Platform.OS === "ios" ? spacing.md : spacing.sm,
    justifyContent: "flex-start",
  },
  headerSection: {
    alignItems: "center",
    marginBottom: spacing.md,
    paddingTop: spacing.md,
  },
  dateCarouselSection: {
    marginBottom: spacing.xl,
  },
  dateCarouselContent: {
    paddingHorizontal: spacing.xs,
    gap: spacing.sm,
  },
  dateCircleContainer: {
    marginHorizontal: spacing.xs,
  },
  inputSection: {
    gap: spacing.sm,
  },
});
