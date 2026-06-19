import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { colors, spacing, typography } from "@/constants/theme";
import { useAuth } from "@/providers/Auth";
import { TimeSlot, updateUserProfile } from "@/api/user";
import { useProfileStore } from "@/stores/profileStore";
import { SubmitButton } from "@/components/ui";
import { CompactColourOptionButton } from "@/components/ui/CompactColourOptionButton";

export default function EditAvailabilityPage() {
  const { user } = useAuth();
  const {
    profile: profileData,
    loadingProfile,
    profileError,
    fetchProfile,
  } = useProfileStore();

  const [weekdayAvailability, setWeekdayAvailability] = useState<TimeSlot[]>(
    []
  );
  const [weekendAvailability, setWeekendAvailability] = useState<TimeSlot[]>(
    []
  );
  const [isSaving, setIsSaving] = useState(false);
  const TIME_SLOT_META: Record<TimeSlot, { title: string; subtitle: string }> =
    {
      [TimeSlot.EARLY_MORNING]: {
        title: "Early Morning",
        subtitle: "(6am - 9am)",
      },
      [TimeSlot.LATE_MORNING]: {
        title: "Late Morning",
        subtitle: "(9am - 12pm)",
      },
      [TimeSlot.LUNCHTIME]: {
        title: "Lunch Time",
        subtitle: "(12pm - 3pm)",
      },
      [TimeSlot.LATE_AFTERNOON]: {
        title: "Late Afternoon",
        subtitle: "(3pm - 6pm)",
      },
      [TimeSlot.EVENING]: {
        title: "Evening",
        subtitle: "(After 6pm)",
      },
    };

  useEffect(() => {
    if (profileData) {
      const timeSlots = profileData.onboarding?.availability?.time_slots || [];
      const weekdaySlots = [
        ...new Set(
          timeSlots
            .filter(
              (slot: { day_type: string; time_slot: TimeSlot }) =>
                slot.day_type === "WEEKDAY"
            )
            .map(
              (slot: { day_type: string; time_slot: TimeSlot }) =>
                slot.time_slot
            )
        ),
      ] as TimeSlot[];
      const weekendSlots = [
        ...new Set(
          timeSlots
            .filter(
              (slot: { day_type: string; time_slot: TimeSlot }) =>
                slot.day_type === "WEEKEND"
            )
            .map(
              (slot: { day_type: string; time_slot: TimeSlot }) =>
                slot.time_slot
            )
        ),
      ] as TimeSlot[];
      setWeekdayAvailability(weekdaySlots);
      setWeekendAvailability(weekendSlots);
    }
  }, [profileData]);

  if (!user) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.infoText}>Please login to edit availability.</Text>
      </View>
    );
  }

  if (loadingProfile) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="small" color={colors.text.primary} />
      </View>
    );
  }

  if (profileError) {
    console.log(profileError);
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.infoText}>Something went wrong...</Text>
      </View>
    );
  }

  const handleWeekdayOptionPress = (option: TimeSlot) => {
    setWeekdayAvailability((prev) => {
      const isSelected = prev.includes(option);
      return isSelected
        ? prev.filter((item) => item !== option)
        : [...prev, option];
    });
  };

  const handleWeekendOptionPress = (option: TimeSlot) => {
    setWeekendAvailability((prev) => {
      const isSelected = prev.includes(option);
      return isSelected
        ? prev.filter((item) => item !== option)
        : [...prev, option];
    });
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const uniqueWeekdayAvailability = [...new Set(weekdayAvailability)];
      const uniqueWeekendAvailability = [...new Set(weekendAvailability)];

      const profileUpdateData = {
        availability: {
          weekdays: uniqueWeekdayAvailability,
          weekends: uniqueWeekendAvailability,
        },
      };

      await updateUserProfile(profileUpdateData);

      if (user) {
        await fetchProfile();
      }

      Alert.alert("Success", "Availability updated successfully!");
    } catch (error) {
      console.error("Error saving availability:", error);
      Alert.alert("Error", "Failed to save availability. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.formContainer}>
          <View style={styles.columnsContainer}>
            <View style={styles.column}>
              <Text style={styles.sectionTitle}>Weekdays</Text>
              <View style={styles.optionsContainer}>
                {[
                  TimeSlot.EARLY_MORNING,
                  TimeSlot.LATE_MORNING,
                  TimeSlot.LUNCHTIME,
                  TimeSlot.LATE_AFTERNOON,
                  TimeSlot.EVENING,
                ].map((option) => (
                  <CompactColourOptionButton
                    key={option}
                    title={TIME_SLOT_META[option].title}
                    subtitle={TIME_SLOT_META[option].subtitle}
                    selected={weekdayAvailability.includes(option)}
                    onPress={() => handleWeekdayOptionPress(option)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.column}>
              <Text style={styles.sectionTitle}>Weekends</Text>
              <View style={styles.optionsContainer}>
                {[
                  TimeSlot.EARLY_MORNING,
                  TimeSlot.LATE_MORNING,
                  TimeSlot.LUNCHTIME,
                  TimeSlot.LATE_AFTERNOON,
                  TimeSlot.EVENING,
                ].map((option) => (
                  <CompactColourOptionButton
                    key={option}
                    title={TIME_SLOT_META[option].title}
                    subtitle={TIME_SLOT_META[option].subtitle}
                    selected={weekendAvailability.includes(option)}
                    onPress={() => handleWeekendOptionPress(option)}
                  />
                ))}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
      <View style={styles.buttonContainer}>
        <SubmitButton
          title="Save Availability"
          isLoading={isSaving}
          onPress={handleSave}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.black,
  },
  scrollView: {
    flex: 1,
    width: "100%",
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.md,
  },
  columnsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    flex: 1,
    paddingTop: spacing.xs,
  },
  column: {
    width: "48%",
  },
  sectionTitle: {
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.medium,
    color: colors.text.primary,
    marginBottom: spacing.md,
    textAlign: "center",
  },
  optionsContainer: {
    gap: spacing.md,
  },
  buttonContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  infoText: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
    textAlign: "center",
  },
});
