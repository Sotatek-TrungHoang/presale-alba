import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacityProps,
  ViewStyle,
} from "react-native";
import { colors, spacing, borderRadius, typography } from "@/constants/theme";
import { Platform } from "react-native";
type ButtonVariant = "primary" | "secondary" | "outline" | "danger";

interface SubmitButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: ButtonVariant;
  isLoading?: boolean;
  fullWidth?: boolean;
}

export const SubmitButton = ({
  title,
  variant = "primary",
  isLoading = false,
  fullWidth = false,
  onPress,
  style,
  disabled,
  ...rest
}: SubmitButtonProps) => {
  const getButtonStyle = () => {
    switch (variant) {
      case "secondary":
        return styles.buttonSecondary;
      case "outline":
        return styles.buttonOutline;
      case "danger":
        return styles.buttonDanger;
      default:
        return styles.buttonPrimary;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case "outline":
        return styles.textOutline;
      default:
        return styles.text;
    }
  };

  const getLoaderColor = () => {
    switch (variant) {
      case "outline":
        return colors.primary.yellow;
      default:
        return colors.neutral.black;
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        getButtonStyle(),
        fullWidth && styles.fullWidth,
        disabled && styles.buttonDisabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || isLoading}
      {...rest}
    >
      {isLoading ? (
        <ActivityIndicator color={getLoaderColor()} size="small" />
      ) : (
        <Text style={[getTextStyle(), disabled && styles.textDisabled]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const buttonShadow: ViewStyle = {
  shadowColor: colors.neutral.black,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.2,
  shadowRadius: 1.41,
  elevation: 2,
};

const styles = StyleSheet.create({
  button: {
    height: Platform.OS === "ios" ? 60 : 52,
    borderRadius: borderRadius.round,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    ...buttonShadow,
  },
  buttonPrimary: {
    backgroundColor: colors.primary.yellow,
    color: colors.text.primary,
  },
  buttonSecondary: {
    backgroundColor: colors.primary.yellow,
    color: colors.neutral.black,
  },
  buttonOutline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.primary.yellow,
    color: colors.neutral.black,
  },
  buttonDanger: {
    backgroundColor: colors.semantic.error,
    color: colors.neutral.white,
  },
  buttonDisabled: {
    backgroundColor: colors.secondary.yellow,
    color: colors.text.primary,
    opacity: 0.5,
  },
  text: {
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
  },
  textOutline: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
  },
  textDisabled: {
    color: colors.text.primary,
    fontFamily: typography.fontFamily.light,
  },
  fullWidth: {
    width: "100%",
  },
});
