import React, { useState, useEffect, useRef, useCallback } from "react";
import { colors, spacing, typography, borderRadius } from "@/constants/theme";
import { StyledInput } from "@/components/ui/StyledInput";
import { useStripeOnboardingStore } from "@/stores/stripeOnboardingStore";
import { parsePhoneNumber, AsYouType } from "libphonenumber-js/max";
import { useProfileStore } from "@/stores/profileStore";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Modal,
  Alert,
  Keyboard,
  ActivityIndicator,
  FlatList,
  TextInput,
} from "react-native";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { updateStripeIndividual } from "@/api/stripe";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import {
  searchAddressComponents,
  DetailedLocation,
  AddressComponent,
} from "@/api/location";
import { debounce } from "lodash";

// Helper to parse address components
const parseAddressComponents = (components: AddressComponent[] | undefined) => {
  let streetNumber = "";
  let route = "";
  let city = "";
  let postalCode = "";

  if (!components) return { line1: "", city: "", postalCode: "" };

  components.forEach((component) => {
    if (component.types.includes("street_number")) {
      streetNumber = component.long_name;
    } else if (component.types.includes("route")) {
      route = component.long_name;
    } else if (component.types.includes("postal_town")) {
      city = component.long_name;
    } else if (component.types.includes("postal_code")) {
      postalCode = component.long_name;
    }
  });

  const line1 = `${streetNumber} ${route}`.trim();
  return { line1, city, postalCode };
};

const formatDob = (day: number, month: number, year: number) => {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(day)} / ${pad(month)} / ${year}`;
};

export default function StripePersonalInfo() {
  const {
    setStep,
    individual,
    setIndividualField,
    setIndividualDobField,
    setIndividualAddressField,
    showAddressSheet,
    setShowAddressSheet,
  } = useStripeOnboardingStore();

  const params = useLocalSearchParams<{ mode?: string }>();
  const isRequirementsMode = params.mode === "requirements";
  const [isSubmittingFix, setIsSubmittingFix] = useState(false);

  const { profile } = useProfileStore((state) => state.profile);

  const [isFormValid, setIsFormValid] = useState(false);
  const [isPhoneValid, setIsPhoneValid] = useState(false);
  const [showPhoneError, setShowPhoneError] = useState(false);
  const [phoneDisplay, setPhoneDisplay] = useState<string>(() => {
    if (individual.phone) {
      return new AsYouType().input(individual.phone);
    }
    return "+44 ";
  });

  const handlePhoneChange = (text: string) => {
    let next = text.trim().length === 0 ? "+" : text;
    if (!next.startsWith("+")) {
      next = "+" + next.replace(/[^\d]/g, "");
    }
    const formatted = new AsYouType().input(next);
    setPhoneDisplay(formatted);

    let valid = false;
    try {
      const parsed = parsePhoneNumber(formatted);
      valid = parsed?.isValid() ?? false;
      if (valid && parsed) {
        setIndividualField("phone", parsed.format("E.164"));
      } else {
        setIndividualField("phone", formatted);
      }
    } catch {
      setIndividualField("phone", formatted);
    }

    setIsPhoneValid(valid);
    setShowPhoneError(!valid && formatted.length > 3);
  };

  useEffect(() => {
    if (!individual.phone) {
      setIndividualField("phone", "+44 ");
    }
  }, []);

  const [date, setDate] = useState<Date>(() => {
    const { day, month, year } = individual.dob;
    if (year && month && day) {
      return new Date(year, month - 1, day);
    }
    const eighteenYearsAgo = new Date();
    eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);
    return eighteenYearsAgo;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [addressComplete, setAddressComplete] = useState(false);
  const [isAddressFormValid, setIsAddressFormValid] = useState(false);

  const [addressSearchQuery, setAddressSearchQuery] = useState("");
  const [addressSearchResults, setAddressSearchResults] = useState<
    DetailedLocation[]
  >([]);
  const [showAddressSearch, setShowAddressSearch] = useState(true);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);

  const headingOpacity = useRef(new Animated.Value(0)).current;
  const headingTranslateY = useRef(new Animated.Value(-20)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;
  const formTranslateY = useRef(new Animated.Value(20)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonTranslateY = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headingOpacity, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(headingTranslateY, {
        toValue: 0,
        duration: 600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(formOpacity, {
        toValue: 1,
        duration: 600,
        delay: 150,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(formTranslateY, {
        toValue: 0,
        duration: 600,
        delay: 150,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(buttonOpacity, {
        toValue: 1,
        duration: 500,
        delay: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(buttonTranslateY, {
        toValue: 0,
        duration: 500,
        delay: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    validateEntireForm();
  }, [individual]);

  useEffect(() => {
    if (profile) {
      if (profile.first_name) {
        setIndividualField("first_name", profile.first_name);
      }
      if (profile.last_name) {
        setIndividualField("last_name", profile.last_name);
      }
      if (profile.email) {
        setIndividualField("email", profile.email);
      }
      setShowAddressSearch(true);
      setAddressComplete(false);
    }
  }, [profile]);

  const validateEntireForm = () => {
    const { first_name, last_name, phone, dob, address } = individual;
    let isValid = true;
    if (!first_name?.trim() || !last_name?.trim()) {
      isValid = false;
    }
    if (!phone?.trim() || !isPhoneValid) {
      isValid = false;
    }

    if (!dob.day || !dob.month || !dob.year) {
      isValid = false;
    } else {
      const tempDate = new Date(dob.year, dob.month - 1, dob.day);
      if (isNaN(tempDate.getTime())) {
        isValid = false;
      }
      const minDob = new Date();
      minDob.setFullYear(minDob.getFullYear() - 120);
      const maxDob = new Date();
      maxDob.setFullYear(maxDob.getFullYear() - 18);
      if (tempDate < minDob || tempDate > maxDob) {
        isValid = false;
      }
    }
    if (
      !address.line1?.trim() ||
      !address.city?.trim() ||
      !address.postal_code?.trim()
    ) {
      isValid = false;
      setAddressComplete(false);
    } else {
      setAddressComplete(true);
    }
    setIsFormValid(isValid);
  };

  const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    const currentDate = selectedDate || date;
    if (Platform.OS === "ios") {
      setDate(currentDate);
    } else {
      setShowDatePicker(false);
      if (event.type === "set" && selectedDate) {
        setDate(selectedDate);
        updateStoreWithDate(selectedDate);
      }
    }
  };
  const updateStoreWithDate = (newDate: Date) => {
    setIndividualDobField("day", newDate.getDate());
    setIndividualDobField("month", newDate.getMonth() + 1);
    setIndividualDobField("year", newDate.getFullYear());
  };
  const handleDatePickerDone = () => {
    updateStoreWithDate(date);
    setShowDatePicker(false);
    setTimeout(() => {
      Keyboard.dismiss();
    }, 50);
  };
  const showDatepicker = () => setShowDatePicker(true);

  const openAddressSheet = () => {
    if (
      individual.address.line1 &&
      individual.address.city &&
      individual.address.postal_code
    ) {
      setShowAddressSearch(false);
    } else {
      setShowAddressSearch(true);
    }
    setAddressSearchQuery("");
    setAddressSearchResults([]);
    setShowAddressSheet(true);
  };
  const closeAddressSheet = () => {
    setShowAddressSheet(false);
    validateEntireForm();
  };

  const validateAddressForm = () => {
    let valid = true;
    if (!individual.address.line1?.trim()) valid = false;
    if (!individual.address.city?.trim()) valid = false;
    if (!individual.address.postal_code?.trim()) valid = false;
    setIsAddressFormValid(valid);
    return valid;
  };

  useEffect(() => {
    if (showAddressSheet && !showAddressSearch) {
      validateAddressForm();
    }
  }, [individual.address, showAddressSheet, showAddressSearch]);

  const handleSaveAddress = () => {
    if (validateAddressForm()) {
      closeAddressSheet();
    } else {
      Alert.alert(
        "Incomplete Address",
        "Please fill all required address fields."
      );
    }
  };

  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (query.trim().length < 3) {
        setAddressSearchResults([]);
        setIsSearchingAddress(false);
        return;
      }
      setIsSearchingAddress(true);
      try {
        const results = await searchAddressComponents(query);
        setAddressSearchResults(results);
      } catch (error) {
        console.error("Failed to search addresses:", error);
        Alert.alert("Search Error", "Could not fetch addresses.");
        setAddressSearchResults([]);
      } finally {
        setIsSearchingAddress(false);
      }
    }, 500),
    []
  );

  useEffect(() => {
    if (addressSearchQuery.trim()) {
      debouncedSearch(addressSearchQuery);
    } else {
      setAddressSearchResults([]);
    }
  }, [addressSearchQuery, debouncedSearch]);

  const handleSelectAddress = (selectedLocation: DetailedLocation) => {
    const { line1, city, postalCode } = parseAddressComponents(
      selectedLocation.address_components
    );

    setIndividualAddressField("line1", line1);
    setIndividualAddressField("line2", "");
    setIndividualAddressField("city", city);
    setIndividualAddressField("postal_code", postalCode);

    setShowAddressSearch(false);
    setAddressSearchQuery("");
    setAddressSearchResults([]);
    Keyboard.dismiss();
  };

  const handleNext = async () => {
    validateEntireForm();
    if (!isFormValid) {
      Alert.alert(
        "Incomplete Information",
        "Please fill out all required fields correctly."
      );
      return;
    }

    // Requirements-mode: PATCH the existing Stripe account directly and
    // return to the requirements screen. No review step, no terms re-accept.
    if (isRequirementsMode) {
      setIsSubmittingFix(true);
      try {
        await updateStripeIndividual({
          first_name: individual.first_name,
          last_name: individual.last_name,
          phone: individual.phone,
          email: individual.email,
          dob: {
            day: individual.dob.day as number,
            month: individual.dob.month as number,
            year: individual.dob.year as number,
          },
          address: {
            line1: individual.address.line1,
            line2: individual.address.line2 || undefined,
            city: individual.address.city,
            postal_code: individual.address.postal_code,
          },
        });
        router.back();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Couldn't update your details.";
        Alert.alert("Update failed", message);
      } finally {
        setIsSubmittingFix(false);
      }
      return;
    }

    setStep(2);
    router.push("/(app)/stripe-onboarding/review");
  };

  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() - 18);
  const minDate = new Date();
  minDate.setFullYear(minDate.getFullYear() - 120);

  const addressSummary = addressComplete
    ? [
        individual.address.line1,
        individual.address.line2,
        individual.address.city,
        individual.address.postal_code,
      ]
        .filter(Boolean)
        .join(", ")
    : "";

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.outerContainer}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContentContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={{
              opacity: headingOpacity,
              transform: [{ translateY: headingTranslateY }],
            }}
          >
            <Text style={styles.title}>Tell us about you</Text>
            <Text style={styles.subtitle}>
              Stripe uses this to verify your identity.
            </Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.formSection,
              {
                opacity: formOpacity,
                transform: [{ translateY: formTranslateY }],
              },
            ]}
          >
            <View style={styles.fieldCard}>
              <Text style={styles.fieldLabel}>LEGAL FIRST NAME</Text>
              <TextInput
                style={styles.fieldInput}
                value={individual.first_name}
                onChangeText={(value) => setIndividualField("first_name", value)}
                placeholder="Legal first name"
                placeholderTextColor={colors.neutral.placeholder}
              />
            </View>

            <View style={styles.fieldCard}>
              <Text style={styles.fieldLabel}>LEGAL LAST NAME</Text>
              <TextInput
                style={styles.fieldInput}
                value={individual.last_name}
                onChangeText={(value) => setIndividualField("last_name", value)}
                placeholder="Legal last name"
                placeholderTextColor={colors.neutral.placeholder}
              />
            </View>

            <TouchableOpacity
              style={styles.fieldCard}
              onPress={showDatepicker}
              activeOpacity={0.7}
            >
              <Text style={styles.fieldLabel}>DATE OF BIRTH</Text>
              <Text
                style={[
                  styles.fieldValue,
                  !individual.dob.day && styles.fieldValuePlaceholder,
                ]}
              >
                {individual.dob.day &&
                individual.dob.month &&
                individual.dob.year
                  ? formatDob(
                      individual.dob.day,
                      individual.dob.month,
                      individual.dob.year
                    )
                  : "DD / MM / YYYY"}
              </Text>
            </TouchableOpacity>

            <View style={styles.fieldCard}>
              <Text style={styles.fieldLabel}>PHONE NUMBER</Text>
              <TextInput
                style={styles.fieldInput}
                value={phoneDisplay}
                onChangeText={handlePhoneChange}
                placeholder="+44 7123 456789"
                placeholderTextColor={colors.neutral.placeholder}
                keyboardType="phone-pad"
              />
              {showPhoneError && (
                <Text style={styles.phoneHint}>
                  Please enter a valid phone number
                </Text>
              )}
            </View>

            <TouchableOpacity
              style={styles.fieldCard}
              onPress={openAddressSheet}
              activeOpacity={0.7}
            >
              <Text style={styles.fieldLabel}>HOME ADDRESS</Text>
              <Text
                style={[
                  styles.fieldValue,
                  !addressComplete && styles.fieldValuePlaceholder,
                ]}
                numberOfLines={2}
              >
                {addressComplete ? addressSummary : "Add your address"}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>

        <Animated.View
          style={[
            styles.buttonContainer,
            {
              opacity: buttonOpacity,
              transform: [{ translateY: buttonTranslateY }],
            },
          ]}
        >
          <SubmitButton
            title={
              isRequirementsMode
                ? isSubmittingFix
                  ? "Saving..."
                  : "Save changes"
                : "Continue"
            }
            onPress={handleNext}
            disabled={!isFormValid || isSubmittingFix}
            isLoading={isSubmittingFix}
            fullWidth
          />
        </Animated.View>
      </KeyboardAvoidingView>

      {showDatePicker && Platform.OS === "ios" && (
        <Modal
          transparent={true}
          animationType="slide"
          visible={showDatePicker}
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View style={styles.dateModalContainerIOS}>
            <View style={styles.iosPickerContainer}>
              <View style={styles.iosPickerHeader}>
                <TouchableOpacity onPress={handleDatePickerDone}>
                  <Text style={styles.iosPickerDoneButton}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                testID="dateTimePickerIOS"
                value={date}
                mode={"date"}
                display={"spinner"}
                onChange={onDateChange}
                maximumDate={maxDate}
                minimumDate={minDate}
                textColor={colors.text.primary}
                style={styles.iosPicker}
              />
            </View>
          </View>
        </Modal>
      )}
      {showDatePicker && Platform.OS === "android" && (
        <DateTimePicker
          testID="dateTimePickerAndroid"
          value={date}
          mode={"date"}
          display={"default"}
          onChange={onDateChange}
          maximumDate={maxDate}
          minimumDate={minDate}
        />
      )}

      <Modal
        visible={showAddressSheet}
        animationType="slide"
        onRequestClose={closeAddressSheet}
        presentationStyle="formSheet"
      >
        <SafeAreaView
          style={styles.modalFullScreenContainer}
          edges={["top", "right", "bottom", "left"]}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "padding"}
            style={{ flex: 1 }}
            keyboardVerticalOffset={Platform.OS === "ios" ? 50 : 0}
          >
            <View style={styles.modalHeaderFullScreen}>
              <Text style={styles.modalTitleFullScreen}>
                {showAddressSearch ? "Search Address" : "Complete Address"}
              </Text>
              <TouchableOpacity
                onPress={closeAddressSheet}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={28} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            {showAddressSearch ? (
              <View style={styles.modalContentScrollFullScreen}>
                <View style={styles.modalFormContentFullScreen}>
                  <StyledInput
                    label="Search for your address"
                    value={addressSearchQuery}
                    onChangeText={setAddressSearchQuery}
                    placeholder="Start typing your address..."
                    autoFocus
                  />
                  {isSearchingAddress && (
                    <ActivityIndicator
                      style={{ marginVertical: spacing.md }}
                      size="small"
                      color={colors.primary.yellow}
                    />
                  )}
                  <FlatList
                    data={addressSearchResults}
                    keyExtractor={(item) =>
                      item.description || `${item.latitude}-${item.longitude}`
                    }
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.searchResultItem}
                        onPress={() => handleSelectAddress(item)}
                      >
                        <Text style={styles.searchResultText}>
                          {item.description}
                        </Text>
                      </TouchableOpacity>
                    )}
                    ListEmptyComponent={() =>
                      !isSearchingAddress &&
                      addressSearchQuery.length > 2 &&
                      addressSearchResults.length === 0 ? (
                        <Text style={styles.noResultsText}>
                          No addresses found. Try a different search.
                        </Text>
                      ) : null
                    }
                    keyboardShouldPersistTaps="handled"
                    style={{ maxHeight: 250 }}
                  />
                </View>
                <View style={styles.modalFooterFullScreen}>
                  <SubmitButton
                    title="Enter Manually Instead"
                    onPress={() => setShowAddressSearch(false)}
                    variant="secondary"
                    fullWidth
                  />
                </View>
              </View>
            ) : (
              <>
                <ScrollView
                  style={styles.modalContentScrollFullScreen}
                  contentContainerStyle={styles.modalFormContentFullScreen}
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={styles.addressFormContainer}>
                    <StyledInput
                      label="Address Line 1"
                      value={individual.address.line1}
                      onChangeText={(value) =>
                        setIndividualAddressField("line1", value)
                      }
                      placeholder="Address Line 1 (e.g., 123 Main St)"
                    />
                    <StyledInput
                      label="Address Line 2 (Optional)"
                      value={individual.address.line2}
                      onChangeText={(value) =>
                        setIndividualAddressField("line2", value)
                      }
                      placeholder="Address Line 2 (Optional)"
                    />
                    <StyledInput
                      label="City"
                      value={individual.address.city}
                      onChangeText={(value) =>
                        setIndividualAddressField("city", value)
                      }
                      placeholder="City"
                    />
                    <StyledInput
                      label="Post Code"
                      value={individual.address.postal_code}
                      onChangeText={(value) =>
                        setIndividualAddressField("postal_code", value)
                      }
                      placeholder="Post Code"
                    />
                    <TouchableOpacity
                      onPress={() => setShowAddressSearch(true)}
                      style={styles.searchAgainButton}
                    >
                      <Text style={styles.searchAgainButtonText}>
                        Search Address Again
                      </Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
                <View style={styles.modalFooterFullScreen}>
                  <SubmitButton
                    title="Save Address"
                    onPress={handleSaveAddress}
                    disabled={!isAddressFormValid}
                    fullWidth
                  />
                </View>
              </>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral.black },
  outerContainer: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
  },
  scrollView: { flexShrink: 1 },
  scrollContentContainer: {
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  title: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.xxl,
    fontFamily: typography.fontFamily.bold,
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
    marginBottom: spacing.xl,
  },
  formSection: {
    gap: spacing.md,
  },
  fieldCard: {
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.sm + 2,
  },
  fieldLabel: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.xs,
    fontFamily: typography.fontFamily.medium,
    letterSpacing: 0.6,
    marginBottom: spacing.xxs,
  },
  fieldValue: {
    color: colors.neutral.white,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
    paddingVertical: spacing.xs,
  },
  fieldValuePlaceholder: {
    color: colors.neutral.placeholder,
  },
  fieldInput: {
    color: colors.neutral.white,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
    paddingVertical: spacing.xs,
    paddingHorizontal: 0,
    margin: 0,
    minHeight: Platform.OS === "ios" ? 28 : 36,
  },
  phoneHint: {
    color: colors.primary.red,
    fontSize: typography.fontSizes.xs,
    fontFamily: typography.fontFamily.regular,
    marginTop: spacing.xs,
  },
  buttonContainer: { paddingVertical: spacing.lg },
  dateModalContainerIOS: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  iosPickerContainer: {
    backgroundColor: colors.neutral.black,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    overflow: "hidden",
    alignItems: "center",
  },
  iosPickerHeader: {
    padding: spacing.md,
    alignItems: "flex-end",
    backgroundColor: colors.neutral.black,
    borderBottomColor: colors.neutral.border,
    width: "100%",
  },
  iosPickerDoneButton: {
    color: colors.primary.yellow,
    fontSize: typography.fontSizes.md,
    fontWeight: "600",
  },
  iosPicker: {
    width: 320,
    backgroundColor: colors.neutral.black,
  },
  modalFullScreenContainer: {
    flex: 1,
    backgroundColor: colors.neutral.black,
    marginTop: Platform.OS === "ios" ? 0 : undefined,
  },
  modalHeaderFullScreen: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.surface,
    position: "relative",
  },
  modalTitleFullScreen: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.lg,
    fontFamily: typography.fontFamily.medium,
  },
  modalCloseButton: {
    position: "absolute",
    right: spacing.lg,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    padding: spacing.sm,
  },
  modalContentScrollFullScreen: { flexShrink: 1 },
  modalFormContentFullScreen: { padding: spacing.lg, flexGrow: 1 },
  modalFooterFullScreen: {
    padding: spacing.lg,
    backgroundColor: colors.neutral.black,
  },
  searchResultItem: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.surface,
  },
  searchResultText: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.md,
  },
  noResultsText: {
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: spacing.lg,
    fontSize: typography.fontSizes.md,
  },
  searchAgainButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  searchAgainButtonText: {
    color: colors.primary.yellow,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.medium,
  },
  addressFormContainer: {
    gap: spacing.md,
  },
});
