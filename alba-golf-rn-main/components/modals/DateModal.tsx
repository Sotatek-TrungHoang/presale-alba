import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";
import { colors, spacing, typography } from "@/constants/theme";
import { RangeSlider } from "@react-native-assets/slider";
import { SubmitButton } from "@/components/ui/SubmitButton";

interface DateRange {
  startDate: Date;
  endDate: Date;
}

interface DateModalProps {
  visible: boolean;
  onClose: () => void;
  onApplyDateRange: (dateRange: DateRange) => void;
  initialDateRange?: DateRange;
}

export function DateModal({
  visible,
  onClose,
  onApplyDateRange,
  initialDateRange,
}: DateModalProps) {
  const today = new Date();
  const maxDaysFromToday = 30; // 30 days from today

  // Calculate initial slider values based on initialDateRange
  const getSliderValueFromDate = (date: Date) => {
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, Math.min(diffDays, maxDaysFromToday));
  };

  const getDateFromSliderValue = (value: number) => {
    const newDate = new Date(today);
    newDate.setDate(today.getDate() + value);
    return newDate;
  };

  const getInitialRange = (): [number, number] => {
    if (initialDateRange) {
      return [
        getSliderValueFromDate(initialDateRange.startDate),
        getSliderValueFromDate(initialDateRange.endDate),
      ];
    }
    return [0, 30]; // Default to today and 30 days from today
  };

  const [sliderRange, setSliderRange] = React.useState<[number, number]>(
    getInitialRange()
  );
  const [selectedDateRange, setSelectedDateRange] = React.useState<DateRange>(
    () => {
      const initialRange = getInitialRange();
      return {
        startDate: getDateFromSliderValue(initialRange[0]),
        endDate: getDateFromSliderValue(initialRange[1]),
      };
    }
  );

  React.useEffect(() => {
    if (visible) {
      const newRange = getInitialRange();
      setSliderRange(newRange);
      setSelectedDateRange({
        startDate: getDateFromSliderValue(newRange[0]),
        endDate: getDateFromSliderValue(newRange[1]),
      });
    }
  }, [visible, initialDateRange]);

  const handleRangeChange = (range: [number, number]) => {
    const roundedRange: [number, number] = [
      Math.round(range[0]),
      Math.round(range[1]),
    ];
    setSliderRange(roundedRange);
    setSelectedDateRange({
      startDate: getDateFromSliderValue(roundedRange[0]),
      endDate: getDateFromSliderValue(roundedRange[1]),
    });
  };

  const handleApply = () => {
    onApplyDateRange(selectedDateRange);
    onClose();
  };

  const handleReset = () => {
    const resetRange: [number, number] = [0, 30];
    setSliderRange(resetRange);
    const resetDateRange = {
      startDate: today,
      endDate: getDateFromSliderValue(30),
    };
    setSelectedDateRange(resetDateRange);
    onApplyDateRange(resetDateRange);
    onClose();
  };

  const formatDate = (date: Date) => {
    const daysDiff = Math.ceil(
      (date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysDiff === 0) {
      return "Today";
    } else if (daysDiff === 1) {
      return "Tomorrow";
    } else {
      return date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    }
  };

  const formatRangeLabel = (days: number) => {
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    return `+${days} days`;
  };

  const formatDateRange = () => {
    const start = formatDate(selectedDateRange.startDate);
    const end = formatDate(selectedDateRange.endDate);

    if (start === end) {
      return start;
    }

    return `${start} - ${end}`;
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Select Date Range</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.dateContainer}>
            <Text style={styles.dateValue}>{formatDateRange()}</Text>
            <RangeSlider
              style={styles.slider}
              range={sliderRange}
              minimumValue={0}
              maximumValue={maxDaysFromToday}
              step={1}
              onValueChange={handleRangeChange}
              inboundColor={colors.primary.yellow}
              outboundColor={colors.neutral.surface}
              thumbTintColor={colors.primary.yellow}
              trackHeight={4}
              thumbSize={20}
            />
            <View style={styles.rangeLabels}>
              <Text style={styles.rangeText}>{formatRangeLabel(0)}</Text>
              <Text style={styles.rangeText}>
                {formatRangeLabel(maxDaysFromToday)}
              </Text>
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity onPress={handleReset} style={styles.resetButton}>
              <Text style={styles.resetText}>Reset to default</Text>
            </TouchableOpacity>
            <SubmitButton title="Apply" onPress={handleApply} fullWidth />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.neutral.black,
    borderRadius: 20,
    padding: spacing.lg,
    width: "100%",
    maxWidth: 400,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: typography.fontSizes.lg,
    fontFamily: typography.fontFamily.semibold,
    color: colors.text.primary,
  },
  closeButton: {
    padding: spacing.sm,
  },
  closeText: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
  },
  dateContainer: {
    marginBottom: spacing.xl,
  },
  dateValue: {
    fontSize: typography.fontSizes.xxl,
    fontFamily: typography.fontFamily.semibold,
    color: colors.primary.yellow,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  slider: {
    width: "100%",
    height: 40,
  },
  rangeLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  rangeText: {
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.text.secondary,
  },
  footer: {
    marginTop: spacing.xl,
  },
  resetButton: {
    alignItems: "center",
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  resetText: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
  },
});
