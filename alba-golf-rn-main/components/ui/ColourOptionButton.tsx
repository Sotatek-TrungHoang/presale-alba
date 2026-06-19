import { View, StyleSheet, TouchableOpacity, Text, Platform } from "react-native";
import { colors, spacing, borderRadius, typography } from "@/constants/theme";
import { LinearGradient } from "expo-linear-gradient";

export const ColourOptionButton = ({
  title,
  subtitle,
  onPress,
  colour,
  selected,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
  colour: string;
  selected: boolean;
}) => {
  const getColour = () => {
    if (selected) {
      switch (colour) {
        case "red":
          return colors.primary.red;
      case "orange":
        return colors.primary.orange;
      case "yellow":
        return colors.primary.yellow;
      case "pink":
        return colors.primary.pink;
        default:
          return colors.neutral.surface;
      }
    }
  };

  const getBackgroundColour = () => {
    if (selected && colour === "red") {
      return colors.secondary.red;
    } else if (selected && colour === "orange") {
      return colors.secondary.orange;
    } else if (selected && colour === "yellow") {
      return colors.secondary.yellow;
    } else if (selected && colour === "pink") {
      return '#4D3240';
    } else {
      return colors.neutral.surface;
      // switch (colour) {
      //   case "red":
      //     return colors.tertiary.red;
      //   case "orange":
      //     return colors.tertiary.orange;
      //   case "yellow":
      //     return colors.tertiary.yellow;
      //   case "pink":
      //     return colors.tertiary.pink;
      //   default:
      //     return colors.neutral.surface;
      // }
    }
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
    height: 83,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  textContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  buttonTitle: {
    fontSize: Platform.OS === "ios" ? 28 : 24,
    fontFamily: typography.fontFamily.semibold,
    color: colors.neutral.white,
    letterSpacing: -0.6,
  },
  buttonSubtitle: {
    fontSize: typography.fontSizes.xs,
    fontFamily: typography.fontFamily.regular,
    color: colors.neutral.white,
    marginTop: 2,
  },
});
