import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyledInput, SubmitButton, Heading } from "@/components/ui";
import { colors, spacing, typography } from "@/constants/theme";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useOnboardingStore } from "@/stores/onboardingStore";
import TermsOfServiceModal from "@/components/moderation/TermsOfServiceModal";

export default function OnboardingStep1() {
  // Get params for backward compatibility or initial loading
  const params = useLocalSearchParams<{
    email: string;
    password: string;
  }>();

  // Get state and actions from our store
  const { email, password, firstName, lastName, setPersonalInfo } =
    useOnboardingStore();

  // Local state for form management
  const [localFirstName, setLocalFirstName] = useState(firstName || "");
  const [localLastName, setLocalLastName] = useState(lastName || "");
  const [firstNameError, setFirstNameError] = useState("");
  const [lastNameError, setLastNameError] = useState("");
  const [isFormValid, setIsFormValid] = useState(false);
  const [firstNameTouched, setFirstNameTouched] = useState(false);
  const [lastNameTouched, setLastNameTouched] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Animation values
  const headingOpacity = useRef(new Animated.Value(0)).current;
  const headingTranslateY = useRef(new Animated.Value(-20)).current;

  const firstNameInputOpacity = useRef(new Animated.Value(0)).current;
  const firstNameInputTranslateX = useRef(new Animated.Value(-30)).current;

  const lastNameInputOpacity = useRef(new Animated.Value(0)).current;
  const lastNameInputTranslateX = useRef(new Animated.Value(-30)).current;

  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonTranslateY = useRef(new Animated.Value(30)).current;

  // Screen exit animations
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const screenScale = useRef(new Animated.Value(1)).current;

  // Initialize from URL params if available (for backward compatibility)
  useEffect(() => {
    if (params.email && params.password) {
      useOnboardingStore
        .getState()
        .setCredentials(params.email, params.password);
    }
  }, [params.email, params.password]);

  // Start entrance animations when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      // Reset animations to initial states before starting
      headingOpacity.setValue(0);
      headingTranslateY.setValue(-20);
      firstNameInputOpacity.setValue(0);
      firstNameInputTranslateX.setValue(-30);
      lastNameInputOpacity.setValue(0);
      lastNameInputTranslateX.setValue(-30);
      buttonOpacity.setValue(0);
      buttonTranslateY.setValue(30);
      screenOpacity.setValue(1); // Ensure screen is visible
      screenScale.setValue(1); // Ensure screen is normal scale

      // Create sequence for heading
      const headingAnimation = Animated.timing(headingOpacity, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      });

      const headingTranslateAnimation = Animated.timing(headingTranslateY, {
        toValue: 0,
        duration: 600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      });

      // First name input animation
      const firstNameAnimation = Animated.parallel([
        Animated.timing(firstNameInputOpacity, {
          toValue: 1,
          duration: 500,
          delay: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(firstNameInputTranslateX, {
          toValue: 0,
          duration: 500,
          delay: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]);

      // Last name input animation
      const lastNameAnimation = Animated.parallel([
        Animated.timing(lastNameInputOpacity, {
          toValue: 1,
          duration: 500,
          delay: 400,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(lastNameInputTranslateX, {
          toValue: 0,
          duration: 500,
          delay: 400,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]);

      // Button animation
      const buttonAnimation = Animated.parallel([
        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 500,
          delay: 500,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(buttonTranslateY, {
          toValue: 0,
          duration: 500,
          delay: 500,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]);

      // Run all entrance animations
      Animated.parallel([
        Animated.parallel([headingAnimation, headingTranslateAnimation]),
        firstNameAnimation,
        lastNameAnimation,
        buttonAnimation,
      ]).start();

      // Optional cleanup function (might not be strictly necessary if resetting on focus)
      // return () => {
      //   // You could potentially reset animations here when screen loses focus
      //   // e.g., headingOpacity.setValue(0);
      // };
    }, []) // Empty dependency array ensures this effect runs on focus/blur cycles
  );

  // Validate form whenever inputs change
  useEffect(() => {
    validateForm();
  }, [localFirstName, localLastName, firstNameTouched, lastNameTouched]);

  // Name validation
  const validateFirstName = () => {
    if (firstNameTouched) {
      if (!localFirstName.trim()) {
        setFirstNameError("First name is required");
        return false;
      } else {
        setFirstNameError("");
      }
    }
    return !!localFirstName.trim();
  };

  const validateLastName = () => {
    if (lastNameTouched) {
      if (!localLastName.trim()) {
        setLastNameError("Last name is required");
        return false;
      } else {
        setLastNameError("");
      }
    }
    return !!localLastName.trim();
  };

  // Combined validation
  const validateForm = () => {
    const isFirstNameValid = validateFirstName();
    const isLastNameValid = validateLastName();
    setIsFormValid(isFirstNameValid && isLastNameValid);
  };

  const handleFirstNameChange = (text: string) => {
    setLocalFirstName(text);
    if (!firstNameTouched) setFirstNameTouched(true);
  };

  const handleLastNameChange = (text: string) => {
    setLocalLastName(text);
    if (!lastNameTouched) setLastNameTouched(true);
  };

  const handleNext = () => {
    if (!isFormValid) return;

    // Show terms modal if not accepted yet
    // if (!termsAccepted) {
    //   setShowTermsModal(true);
    //   return;
    // }

    // Update the store with personal info
    setPersonalInfo(localFirstName, localLastName);

    // Animate out before navigation
    Animated.parallel([
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(screenScale, {
        toValue: 1.05,
        duration: 400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Navigate to the next step after animation completes
      router.push("/onboarding/step2");
    });
  };

  const handleAcceptTerms = () => {
    setTermsAccepted(true);
    setShowTermsModal(false);
    // Continue with the flow
    handleNext();
  };

  const handleDeclineTerms = () => {
    setShowTermsModal(false);
    // Could redirect to login or show error
  };

  const handleBack = () => {
    // Return to the login page
    router.back();
  };

  return (
    <Animated.View
      style={[
        styles.animatedContainer,
        {
          opacity: screenOpacity,
          transform: [{ scale: screenScale }],
        },
      ]}
    >
      <SafeAreaView style={styles.container} edges={["left", "right"]}>
        <ScrollView
          contentContainerStyle={styles.scrollViewContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formContainer}>
            {/* Header and Inputs positioned at the top */}
            <View style={styles.topSection}>
              <Animated.View
                style={[
                  styles.headerSection,
                  {
                    opacity: headingOpacity,
                    transform: [{ translateY: headingTranslateY }],
                  },
                ]}
              >
                <Heading level={1} weight="light">
                  What should we call you?
                </Heading>
              </Animated.View>

              <View style={styles.inputSection}>
                <Animated.View
                  style={{
                    opacity: firstNameInputOpacity,
                    transform: [{ translateX: firstNameInputTranslateX }],
                  }}
                >
                  <StyledInput
                    label="First Name"
                    placeholder="Enter your first name"
                    value={localFirstName}
                    onChangeText={handleFirstNameChange}
                    error={firstNameError}
                    onBlur={() => setFirstNameTouched(true)}
                    autoFocus
                  />
                </Animated.View>

                <Animated.View
                  style={{
                    opacity: lastNameInputOpacity,
                    transform: [{ translateX: lastNameInputTranslateX }],
                    marginTop: spacing.md,
                  }}
                >
                  <StyledInput
                    label="Last Name"
                    placeholder="Enter your last name"
                    value={localLastName}
                    onChangeText={handleLastNameChange}
                    error={lastNameError}
                    onBlur={() => setLastNameTouched(true)}
                  />
                </Animated.View>
              </View>
            </View>

            <Animated.View
              style={[
                styles.buttonSection,
                {
                  opacity: buttonOpacity,
                  transform: [{ translateY: buttonTranslateY }],
                },
              ]}
            >
              <SubmitButton
                title="Continue"
                fullWidth
                onPress={handleNext}
                disabled={!isFormValid}
              />
            </Animated.View>
          </View>
        </ScrollView>
      </SafeAreaView>
      
      {/* <TermsOfServiceModal
        visible={showTermsModal}
        onAccept={handleAcceptTerms}
        onDecline={handleDeclineTerms}
      /> */}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  animatedContainer: {
    flex: 1,
    backgroundColor: colors.neutral.black,
  },
  container: {
    flex: 1,
    backgroundColor: colors.neutral.black,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  formContainer: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  topSection: {
    marginTop: 0,
  },
  headerSection: {
    alignItems: "center",
    marginBottom: spacing.sm,
    paddingTop: spacing.md,
  },
  inputSection: {
    marginTop: spacing.sm,
  },
  buttonSection: {
    marginTop: spacing.md,
    paddingBottom: 0,
  },
  scrollViewContent: {
    paddingTop: spacing.lg,
  },
});
