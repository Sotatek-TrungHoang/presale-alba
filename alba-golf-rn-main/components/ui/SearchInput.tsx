import React from "react";
import {
  TextInput,
  TextInputProps,
  StyleSheet,
  View,
  Text,
  Pressable,
} from "react-native";
import { colors, spacing, borderRadius, typography } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
interface SearchInputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: "search" | "chevron-back";
  onLeftIconPress?: () => void;
}

export const SearchInput = ({
  label,
  error,
  placeholder,
  value,
  onChangeText,
  leftIcon = "search",
  onLeftIconPress,
  ...rest
}: SearchInputProps) => {
  return (
    <View style={styles.container}>
      {label && (
        <Text style={{ display: "none" }} accessibilityLabel={label}>
          {label}
        </Text>
      )}
      <View style={styles.searchContainer}>
        {onLeftIconPress ? (
          <Pressable onPress={onLeftIconPress} hitSlop={8}>
            <Ionicons name={leftIcon} size={24} color={colors.text.primary} />
          </Pressable>
        ) : (
          <Ionicons
            name={leftIcon}
            size={24}
            color={colors.neutral.placeholder}
          />
        )}
        <TextInput
          style={[styles.input, error ? styles.inputError : null]}
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
          placeholderTextColor={colors.neutral.placeholder}
          {...rest}
        />
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    marginBottom: spacing.md,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.round,
    paddingHorizontal: spacing.md,
    height: 52,
  },
  input: {
    flex: 1,
    color: colors.neutral.white,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
    marginLeft: spacing.sm,
    height: "100%",
  },
  inputError: {
    borderColor: colors.semantic.error,
  },
  errorText: {
    color: colors.semantic.error,
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamily.regular,
    marginTop: spacing.xs,
  },
});
