import React from "react";
import {
  TextInput,
  TextInputProps,
  StyleSheet,
  Platform,
  // View and Text are no longer needed
} from "react-native";
import { colors, spacing, borderRadius, typography } from "@/constants/theme";

// The interface is the same
interface StyledInputProps extends TextInputProps {
  label?: string;
  error?: string;
}

// The component now returns ONLY the TextInput
export const StyledInput = ({
  label,
  error,
  ...rest // We only need the rest of the props
}: StyledInputProps) => {
  // The logic is now just applying the style
  const inputStyles = [styles.input, error ? styles.inputError : null];

  return (
    <TextInput
      style={inputStyles}
      placeholderTextColor={colors.neutral.placeholder}
      {...rest}
    />
  );
};

// The styles are the same minimal ones from the last test
const styles = StyleSheet.create({
  input: {
  color: colors.neutral.white,
  backgroundColor: colors.neutral.surface,
  borderRadius: borderRadius.round,
  // padding: spacing.md,
  paddingHorizontal: spacing.md,
  fontSize: typography.fontSizes.md,
  fontFamily: typography.fontFamily.regular,
  borderWidth: 1,
  borderColor: "transparent",
  width: "100%", // Add width here since the container is gone
  height: Platform.OS === "ios" ? 60 : 50,
  ...(Platform.OS === "android" && {
    textAlignVertical: "center",
  }),
},
inputError: {
  borderColor: colors.semantic.error,
},
});

// input: {
//   color: colors.neutral.white,
//   backgroundColor: colors.neutral.surface,
//   borderRadius: borderRadius.round,
//   padding: spacing.md,
//   fontSize: typography.fontSizes.md,
//   borderWidth: 1,
//   borderColor: "transparent",
//   width: "100%", // Add width here since the container is gone
//   marginBottom: spacing.md, // Add margin here since the container is gone
// },
// inputError: {
//   borderColor: colors.semantic.error,
// },