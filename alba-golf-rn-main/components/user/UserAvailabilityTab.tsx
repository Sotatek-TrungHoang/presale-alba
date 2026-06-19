import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, typography, spacing } from "@/constants/theme";
import { TimeSlot } from "@/api/user";

function formatEnumText(text: string) {
  return text
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

interface UserAvailabilityTabProps {
  onboarding: any;
}

export const UserAvailabilityTab: React.FC<UserAvailabilityTabProps> = ({
  onboarding,
}) => {
  const timeSlots = onboarding?.availability?.time_slots || [];
  const weekdaySlots = [
    ...new Set(
      timeSlots
        .filter(
          (slot: { day_type: string; time_slot: TimeSlot }) =>
            slot.day_type === "WEEKDAY"
        )
        .map(
          (slot: { day_type: string; time_slot: TimeSlot }) => slot.time_slot
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
          (slot: { day_type: string; time_slot: TimeSlot }) => slot.time_slot
        )
    ),
  ] as TimeSlot[];

  if (weekdaySlots.length === 0 && weekendSlots.length === 0) return null;

  return (
    <View style={styles.section}>
      {weekdaySlots.length > 0 && (
        <View style={styles.availabilitySubsection}>
          <Text style={styles.subsectionTitle}>Weekdays</Text>
          <View style={styles.availabilityTags}>
            {weekdaySlots.map((slot, index) => (
              <View key={index} style={styles.availabilityTag}>
                <Text style={styles.availabilityTagText}>
                  {formatEnumText(slot)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
      {weekendSlots.length > 0 && (
        <View style={styles.availabilitySubsection}>
          <Text style={styles.subsectionTitle}>Weekends</Text>
          <View style={styles.availabilityTags}>
            {weekendSlots.map((slot, index) => (
              <View key={index} style={styles.availabilityTag}>
                <Text style={styles.availabilityTagText}>
                  {formatEnumText(slot)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.md,
  },
  subsectionTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.lg,
    fontFamily: typography.fontFamily.medium,
    marginBottom: spacing.md,
  },
  availabilitySubsection: {
    marginBottom: spacing.md,
  },
  availabilityTags: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  availabilityTag: {
    backgroundColor: colors.neutral.black,
    borderColor: colors.text.primary,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: spacing.xl,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  availabilityTagText: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.xs,
    fontFamily: typography.fontFamily.regular,
  },
});
