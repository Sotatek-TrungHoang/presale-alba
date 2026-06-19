import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "@/constants/theme";
import { DateModal } from "@/components/modals/DateModal";
import { DistanceModal } from "@/components/modals/DistanceModal";
import { LocationFilterModal } from "@/components/modals/LocationFilterModal";

interface DateRange {
  startDate: Date;
  endDate: Date;
}

interface LocationFilter {
  name: string;
  latitude: number;
  longitude: number;
}

interface FiltersProps {
  selectedDateRange: DateRange;
  distance: number;
  selectedLocation: LocationFilter | null;
  onDateRangeChange: (dateRange: DateRange) => void;
  onDistanceChange: (distance: number) => void;
  onLocationChange: (location: LocationFilter | null) => void;
}

export default function Filters({
  selectedDateRange,
  distance,
  selectedLocation,
  onDateRangeChange,
  onDistanceChange,
  onLocationChange,
}: FiltersProps) {
  const [isDateModalVisible, setIsDateModalVisible] = useState(false);
  const [isDistanceModalVisible, setIsDistanceModalVisible] = useState(false);
  const [isLocationModalVisible, setIsLocationModalVisible] = useState(false);

  const handleDateRangeSelect = (dateRange: DateRange) => {
    onDateRangeChange(dateRange);
  };

  const handleDistanceChange = (newDistance: number) => {
    onDistanceChange(newDistance);
  };

  const handleLocationSelect = (location: LocationFilter) => {
    onLocationChange(location);
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return "Tomorrow";
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }
  };

  const formatDateRangeDisplay = (dateRange: DateRange) => {
    // Check if it's the default range (today to 30 days from today)
    const today = new Date();
    const thirtyDaysFromToday = new Date(today);
    thirtyDaysFromToday.setDate(today.getDate() + 30);

    const isDefaultRange =
      selectedDateRange.startDate.toDateString() === today.toDateString() &&
      selectedDateRange.endDate.toDateString() ===
        thirtyDaysFromToday.toDateString();

    if (isDefaultRange) {
      return "Date";
    }

    const start = formatDate(dateRange.startDate);
    const end = formatDate(dateRange.endDate);

    if (start === end) {
      return start;
    }

    // If it's a short range, show both dates
    const daysDiff = Math.ceil(
      (dateRange.endDate.getTime() - dateRange.startDate.getTime()) /
        (1000 * 60 * 60 * 24)
    );

    if (daysDiff <= 7) {
      return `${start} - ${end}`;
    }

    // For longer ranges, show a more compact format
    return `${start} - ${end}`;
  };

  const isDateFilterActive = () => {
    const today = new Date();
    const thirtyDaysFromToday = new Date(today);
    thirtyDaysFromToday.setDate(today.getDate() + 30);

    // Check if it's not the default range (today to 30 days from today)
    return !(
      selectedDateRange.startDate.toDateString() === today.toDateString() &&
      selectedDateRange.endDate.toDateString() ===
        thirtyDaysFromToday.toDateString()
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.filterButtonsRow}>
        <TouchableOpacity
          style={[
            styles.filterButton,
            selectedLocation?.name === "Selected Area" &&
              styles.activeFilterButton,
          ]}
          onPress={() => setIsLocationModalVisible(true)}
        >
          <View style={styles.locationFilterContent}>
            <Ionicons
              name="location"
              size={16}
              color={
                selectedLocation?.name === "Selected Area"
                  ? colors.neutral.black
                  : colors.text.primary
              }
              style={styles.locationIcon}
            />
            <Text
              style={[
                styles.filterButtonText,
                selectedLocation?.name === "Selected Area" &&
                  styles.activeFilterButtonText,
              ]}
              numberOfLines={1}
            >
              {selectedLocation?.name || "Location"}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterButton,
            isDateFilterActive() && styles.activeFilterButton,
          ]}
          onPress={() => setIsDateModalVisible(true)}
        >
          <View style={styles.dateFilterContent}>
            <Text
              style={[
                styles.filterButtonText,
                isDateFilterActive() && styles.activeFilterButtonText,
              ]}
              numberOfLines={1}
            >
              {formatDateRangeDisplay(selectedDateRange)}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterButton,
            styles.distanceButton,
            distance <= 50 && styles.activeFilterButton,
          ]}
          onPress={() => setIsDistanceModalVisible(true)}
        >
          <Text
            style={[
              styles.filterButtonText,
              distance <= 50 && styles.activeFilterButtonText,
            ]}
          >
            {distance > 50 ? "Distance" : `${distance}km`}
          </Text>
        </TouchableOpacity>
      </View>

      <LocationFilterModal
        visible={isLocationModalVisible}
        onClose={() => setIsLocationModalVisible(false)}
        onSelectLocation={handleLocationSelect}
        selectedLocation={selectedLocation}
      />

      <DateModal
        visible={isDateModalVisible}
        onClose={() => setIsDateModalVisible(false)}
        onApplyDateRange={handleDateRangeSelect}
        initialDateRange={selectedDateRange}
      />

      <DistanceModal
        visible={isDistanceModalVisible}
        onClose={() => setIsDistanceModalVisible(false)}
        onApplyDistance={handleDistanceChange}
        initialDistance={distance}
        defaultDistance={1000}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.md,
    backgroundColor: colors.neutral.black,
  },
  filterButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  filterButton: {
    backgroundColor: colors.neutral.surface,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.xl,
    marginRight: spacing.sm,
    height: 36,
    justifyContent: "center",
  },
  filterButtonText: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.xs,
    fontFamily: typography.fontFamily.medium,
  },
  activeFilterButton: {
    backgroundColor: colors.primary.yellow,
  },
  activeFilterButtonText: {
    color: colors.neutral.black,
    fontFamily: typography.fontFamily.medium,
  },
  locationFilterContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  locationIcon: {
    marginRight: spacing.xs,
  },
  dateFilterContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  dateIcon: {
    marginRight: spacing.xs,
  },
  distanceButton: {
    minWidth: 70,
  },
});
