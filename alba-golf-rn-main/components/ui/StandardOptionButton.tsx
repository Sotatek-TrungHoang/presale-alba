import { View, StyleSheet, TouchableOpacity, Text, Platform } from "react-native";
import { colors, spacing, borderRadius, typography } from "@/constants/theme";

export const StandardOptionButton = ({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
}) => {
  return (
    <TouchableOpacity onPress={onPress}>
      <View style={styles.button}>
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
    borderColor: colors.neutral.surfaceSecondary,
    backgroundColor: colors.neutral.surface,
    // borderWidth: 1,
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
