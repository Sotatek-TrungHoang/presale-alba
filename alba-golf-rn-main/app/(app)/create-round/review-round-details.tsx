import React, { useRef, useCallback, useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  Animated,
  Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SubmitButton, Heading } from "@/components/ui";
import { colors, spacing, typography } from "@/constants/theme";
import { router, useFocusEffect } from "expo-router";
import { useCreateGameStore } from "@/stores/createGameStore";
import GameListing from "@/components/ui/GameListing";
import { useProfileStore } from "@/stores/profileStore";
import { createGame, createGameDto } from "@/api/games";

export default function ReviewGameDetailsScreen() {
  const {
    playersNeeded,
    timeSlot,
    gameType,
    gameFormat,
    selectedCourse,
    selectedDate,
    resetCreateGame,
  } = useCreateGameStore();
  const { profile } = useProfileStore();

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Animation Values
  const headingOpacity = useRef(new Animated.Value(0)).current;
  const headingTranslateY = useRef(new Animated.Value(-20)).current;
  const descriptionOpacity = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(20)).current;

  useFocusEffect(
    useCallback(() => {
      headingOpacity.setValue(0);
      headingTranslateY.setValue(-20);
      descriptionOpacity.setValue(0);
      cardOpacity.setValue(0);
      cardTranslateY.setValue(20);

      Animated.parallel([
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
        Animated.timing(descriptionOpacity, {
          toValue: 1,
          duration: 500,
          delay: 100,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 400,
          delay: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(cardTranslateY, {
          toValue: 0,
          duration: 400,
          delay: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    }, [])
  );

  const handleConfirmGame = async () => {
    if (
      !playersNeeded ||
      !timeSlot ||
      !gameType ||
      !gameFormat ||
      !selectedCourse ||
      !selectedDate
    ) {
      console.error("Attempted to submit round creation with incomplete data.");
      alert("Please ensure all round details are filled out.");
      return;
    }

    setIsSubmitting(true);

    const organiserHandicapValue = (profile?.onboarding?.handicap_range ||
      "DONT_KNOW") as createGameDto["organiser_handicap"];

    try {
      const createGameResponse = await createGame({
        course_id: selectedCourse.id,
        date: new Date(selectedDate),
        time_slot: timeSlot as createGameDto["time_slot"],
        players_needed: playersNeeded,
        players_current: 1,
        is_booked: false,
        game_type: gameType as createGameDto["game_type"],
        game_format: gameFormat as createGameDto["game_format"],
        organiser_handicap: organiserHandicapValue,
      });
      resetCreateGame();
      router.replace("/" as any);
    } catch (error) {
      console.error("Failed to create round:", error);
      alert("Error creating round. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
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
          <Heading level={2} weight="light">
            Your round is
          </Heading>
          <Heading level={2} weight="light">
            almost ready!
          </Heading>
        </Animated.View>

        <Animated.Text
          style={[styles.description, { opacity: descriptionOpacity }]}
        >
          Confirm below and we'll let you know when people want to join in
        </Animated.Text>

        <Animated.View
          style={{
            opacity: cardOpacity,
            transform: [{ translateY: cardTranslateY }],
          }}
        >
          <GameListing
            id={null}
            playersInGame={[
              {
                user_id: profile.id,
                user: {
                  id: profile.id,
                  profile: {
                    first_name: profile.profile.first_name,
                    photo: profile.profile.photo,
                  },
                },
                status: "CONFIRMED",
              },
            ]}
            creatorId={profile?.id || null}
            playersNeeded={playersNeeded}
            timeSlot={timeSlot}
            gameType={gameType}
            gameFormat={gameFormat}
            courseName={selectedCourse?.name || null}
            courseId={selectedCourse?.id || null}
            selectedDate={selectedDate}
            reviewCard={true}
          />
        </Animated.View>
      </ScrollView>

      <View style={styles.stickyButtonContainer}>
        <SubmitButton
          title="Confirm"
          onPress={handleConfirmGame}
          isLoading={isSubmitting}
          disabled={
            !playersNeeded ||
            !timeSlot ||
            !gameType ||
            !gameFormat ||
            !selectedCourse ||
            !selectedDate
          }
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
  },
  headerContent: {
    alignItems: "center",
    marginBottom: spacing.md,
  },
  title: {
    color: colors.text.primary,
    textAlign: "center",
  },
  description: {
    color: colors.text.secondary,
    textAlign: "center",
    marginBottom: spacing.xl,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSizes.md,
    paddingHorizontal: spacing.sm,
  },
  stickyButtonContainer: {
    padding: spacing.lg,
    backgroundColor: colors.neutral.black,
  },
});
