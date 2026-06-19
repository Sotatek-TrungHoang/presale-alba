import { View, StyleSheet, TouchableOpacity, Text } from "react-native";
import { colors, spacing, borderRadius, typography } from "@/constants/theme";

export const CompactColourOptionButton = ({
  title,
  subtitle,
  onPress,
//   colour,
  selected,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
//   colour: string;
  selected: boolean;
}) => {
  const getColour = () => {
    if (selected) {
      return colors.primary.yellow;
    // } else {
    //   switch (colour) {
    //     case "red":
    //       return colors.primary.red;
    //     case "orange":
    //       return colors.primary.orange;
    //     case "yellow":
    //       return colors.primary.yellow;
    //     case "pink":
    //       return colors.primary.pink;
    //     default:
    //       return colors.neutral.surface;
    //   }
    }
  };

  const getBackgroundColour = () => {
    // if (selected) {
    //   switch (colour) {
    //     case "red":
    //       return colors.secondary.red;
    //     case "orange":
    //       return colors.secondary.orange;
    //     case "yellow":
    //       return colors.secondary.yellow;
    //     case "pink":
    //       return colors.primary.pink;
    //     default:
    //       return colors.neutral.surface;
    //   }
    // } else {
      return colors.neutral.surface;
    // }
  };

  return (
    <TouchableOpacity onPress={onPress}>
      <View
        style={[
          styles.button,
          { borderColor: getColour(), backgroundColor: getBackgroundColour() },
        ]}
      >
        <View style={styles.textContainer}>
          <Text style={styles.buttonTitle}>{title}</Text>
          {subtitle && <Text style={styles.buttonSubtitle}>{subtitle}</Text>}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    height: 55, // Further reduced height from 65
    borderRadius: borderRadius.md, // Using a smaller border radius
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
  },
  textContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  buttonTitle: {
    fontSize: typography.fontSizes.sm, // Smaller font size
    fontFamily: typography.fontFamily.semibold,
    color: colors.neutral.white,
    letterSpacing: -0.3,
  },
  buttonSubtitle: {
    fontSize: typography.fontSizes.xs,
    fontFamily: typography.fontFamily.regular,
    color: colors.neutral.white,
    marginTop: 1, // Smaller margin
  },
});
