import { View, StyleSheet, TouchableOpacity, Text } from "react-native";
import { colors, spacing, typography } from "@/constants/theme";

interface DateCircleButtonProps {
  date: Date;
  dayName: string;
  selected: boolean;
  onPress: () => void;
}

export const DateCircleButton = ({
  date,
  dayName,
  selected,
  onPress,
}: DateCircleButtonProps) => {
  return (
    <TouchableOpacity onPress={onPress}>
      <View style={styles.container}>
        <Text style={styles.dayText}>{dayName}</Text>
        <View style={[styles.circleContainer, selected && styles.selectedContainer]}>
          <Text style={[styles.dateText, selected && styles.selectedText]}>
            {date.getDate()}
          </Text>
        </View>
        <Text style={styles.monthText}>
          {date.toLocaleString("default", { month: "short" })}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: spacing.sm,
  },
  circleContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.neutral.black,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.neutral.surfaceSecondary,
  },
  selectedContainer: {
    borderColor: colors.primary.yellow,
  },
  dayText: {
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.semibold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  dateText: {
    fontSize: typography.fontSizes.xxl,
    fontFamily: typography.fontFamily.light,
    color: colors.text.primary,
    textAlign: "center",
    textAlignVertical: "center",
    includeFontPadding: false,
  },
  monthText: {
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.light,
    color: colors.text.primary,
  },
  selectedText: {
    color: colors.primary.yellow,
  },
});
