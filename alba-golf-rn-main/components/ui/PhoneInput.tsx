import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
} from "react-native";
import CountryPicker, {
  Country,
  CountryCode,
} from "react-native-country-picker-modal";
import {
  parsePhoneNumber,
  AsYouType,
  CountryCode as LibPhoneCountryCode,
} from "libphonenumber-js/max";
import { colors, spacing, typography, borderRadius } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";

interface PhoneInputProps {
  value: string;
  onChangeText: (value: string) => void;
  onValidationChange?: (isValid: boolean) => void;
  placeholder?: string;
  showError?: boolean;
}

export const PhoneInput: React.FC<PhoneInputProps> = ({
  value,
  onChangeText,
  onValidationChange,
  placeholder = "Phone number",
  showError,
}) => {
  const [countryCode, setCountryCode] = useState<CountryCode>("GB");
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [formattedNumber, setFormattedNumber] = useState("");
  const [isValid, setIsValid] = useState(false);
  const [isTouched, setIsTouched] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const validateAndUpdateNumber = (
    text: string,
    currentCountry: CountryCode
  ) => {
    // Remove any non-numeric characters from the input, but keep plus sign if it exists
    const cleanedValue = text.startsWith("+") ? text : text.replace(/\D/g, "");

    // Format the number as the user types
    const asYouType = new AsYouType({
      defaultCountry: currentCountry as LibPhoneCountryCode,
    });
    const formatted = asYouType.input(cleanedValue);
    setFormattedNumber(formatted);

    try {
      // Only validate if we have some input
      if (cleanedValue.length > 0) {
        let phoneNumber;
        try {
          // First try parsing with the plus sign if it exists
          phoneNumber = parsePhoneNumber(formatted);
        } catch {
          // If that fails, try parsing with the country code
          try {
            phoneNumber = parsePhoneNumber(formatted, {
              defaultCountry: currentCountry as LibPhoneCountryCode,
            });
          } catch {
            // If both parsing attempts fail, mark as invalid
            phoneNumber = null;
          }
        }

        const valid = phoneNumber?.isValid() || false;
        setIsValid(valid);

        // Only notify parent of validation state if not focused
        onValidationChange?.(valid);

        // Update the parent component with the full international format
        if (valid && phoneNumber) {
          onChangeText(phoneNumber.format("E.164")); // E.164 format: +447123456789
        } else {
          onChangeText(formatted);
        }
      } else {
        // Empty input
        setIsValid(false);
        onChangeText("");
        onValidationChange?.(false);
      }
    } catch (error) {
      // If any unexpected error occurs, just update the formatted number
      setIsValid(false);
      onChangeText(formatted);
      onValidationChange?.(false);
    }
  };

  const handleTextChange = (text: string) => {
    validateAndUpdateNumber(text, countryCode);
  };

  const handleBlur = () => {
    setIsFocused(false);
    setIsTouched(true);
    validateAndUpdateNumber(formattedNumber, countryCode);
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const onSelect = (country: Country) => {
    setCountryCode(country.cca2);
    // If there's already a number, reformat it with the new country code
    if (formattedNumber) {
      validateAndUpdateNumber(formattedNumber, country.cca2);
    }
  };

  // Theme for the country picker modal
  const countryPickerTheme = {
    primaryColor: colors.primary.yellow,
    primaryColorVariant: colors.neutral.surface,
    backgroundColor: colors.neutral.black,
    onBackgroundTextColor: colors.text.primary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
    filterPlaceholderTextColor: colors.text.secondary,
    activeOpacity: 0.8,
    itemHeight: 52,
    flagSize: 24,
    letterColor: colors.text.primary,
  };

  const FlagButton = () => (
    <View style={styles.flagContainer}>
      <View style={styles.flagWrapper}>
        <CountryPicker
          countryCode={countryCode}
          withFlag
          withCallingCode
          withFilter={false}
          withAlphaFilter={false}
          onSelect={() => {}}
          theme={countryPickerTheme}
        />
      </View>
      <Ionicons
        name="chevron-down"
        size={16}
        color={colors.text.secondary}
        style={styles.chevron}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.countryPickerButton}
        onPress={() => setShowCountryPicker(true)}
      >
        <CountryPicker
          countryCode={countryCode}
          withFlag
          withCallingCode
          withFilter
          withAlphaFilter
          withEmoji
          onSelect={onSelect}
          visible={showCountryPicker}
          onClose={() => setShowCountryPicker(false)}
          containerButtonStyle={styles.countryPickerContainer}
          theme={countryPickerTheme}
          renderFlagButton={FlagButton}
          modalProps={{
            animationType: "slide",
          }}
          onOpen={() => {
            // Small delay to ensure the modal is fully opened before scrolling
            setTimeout(() => {
              // This will trigger the scroll to the selected country
              setCountryCode(countryCode);
            }, 100);
          }}
        />
      </TouchableOpacity>

      <View style={styles.inputContainer}>
        <TextInput
          style={[
            styles.input,
            isValid && styles.validInput,
            !isValid && isTouched && !isFocused && styles.invalidInput,
          ]}
          value={formattedNumber}
          onChangeText={handleTextChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          keyboardType="phone-pad"
          placeholder={placeholder}
          placeholderTextColor={colors.neutral.placeholder}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.round,
    overflow: "hidden",
  },
  countryPickerButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    borderRightWidth: 1,
    borderRightColor: colors.neutral.black,
    height: 52,
  },
  countryPickerContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  flagContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  flagWrapper: {
    justifyContent: "center",
  },
  chevron: {
    marginLeft: spacing.xs,
  },
  inputContainer: {
    flex: 1,
    height: 52,
  },
  input: {
    flex: 1,
    color: colors.text.primary,
    paddingHorizontal: spacing.md,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
  },
  validInput: {
    color: colors.text.primary,
  },
  invalidInput: {
    color: colors.primary.red,
  },
});
