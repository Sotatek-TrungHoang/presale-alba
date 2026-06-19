import React, { useState, useEffect, useRef } from "react";
import { colors, spacing, typography } from "@/constants/theme";
import { useStripeOnboardingStore } from "@/stores/stripeOnboardingStore";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  Easing,
  Alert,
  TouchableOpacity,
} from "react-native";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

// Animated Section Component
interface AnimatedSectionProps {
  children: React.ReactNode;
  onPress: () => void;
  index: number;
}

const AnimatedSection: React.FC<AnimatedSectionProps> = ({
  children,
  onPress,
  index,
}) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        delay: 200 + index * 100,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 400,
        delay: 200 + index * 100,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [index]);

  return (
    <Animated.View
      style={[
        styles.sectionContainer,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
};

export default function ReviewInfo() {
  const { individual, setShowAddressSheet, setStep } =
    useStripeOnboardingStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const headingOpacity = useRef(new Animated.Value(0)).current;
  const headingTranslateY = useRef(new Animated.Value(-20)).current;
  const descriptionOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headingOpacity, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(headingTranslateY, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(descriptionOpacity, {
        toValue: 1,
        duration: 500,
        delay: 100,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleSubmit = async () => {
    setStep(3);
    router.push("/(app)/stripe-onboarding/terms");
  };

  const handleEditSection = (section: "personal" | "address") => {
    if (section === "address") {
      setShowAddressSheet(true);
    }
    router.back();
  };

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContentContainer}
      >
        <Animated.View
          style={[
            styles.headerContent,
            {
              opacity: headingOpacity,
              transform: [{ translateY: headingTranslateY }],
            },
          ]}
        >
          <Text style={styles.title}>Quick check before we continue</Text>
          <Text style={styles.description}>
            We’ll share just the details below with Stripe to verify it’s you
          </Text>
        </Animated.View>

        <View style={styles.summaryOuterContainer}>
          <View style={styles.summaryInnerContainer}>
            <AnimatedSection
              index={0}
              onPress={() => handleEditSection("personal")}
            >
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Personal Information</Text>
                <View style={styles.editContainer}>
                  <Text style={styles.editText}>Edit</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={colors.text.secondary}
                  />
                </View>
              </View>
              <View style={styles.preferenceItem}>
                <Text style={styles.preferenceLabel}>Name</Text>
                <Text style={styles.preferenceValue}>
                  {individual.first_name} {individual.last_name}
                </Text>
              </View>
              <View style={styles.preferenceItem}>
                <Text style={styles.preferenceLabel}>Phone</Text>
                <Text style={styles.preferenceValue}>{individual.phone}</Text>
              </View>
              <View style={styles.preferenceItem}>
                <Text style={styles.preferenceLabel}>Date of Birth</Text>
                <Text style={styles.preferenceValue}>
                  {individual.dob.day}/{individual.dob.month}/{individual.dob.year}
                </Text>
              </View>
            </AnimatedSection>

            <AnimatedSection
              index={1}
              onPress={() => handleEditSection("address")}
            >
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Address</Text>
                <View style={styles.editContainer}>
                  <Text style={styles.editText}>Edit</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={colors.text.secondary}
                  />
                </View>
              </View>
              <View style={styles.preferenceItem}>
                <Text style={styles.preferenceLabel}>Street Address</Text>
                <Text style={styles.preferenceValue}>
                  {individual.address.line1}
                </Text>
              </View>
              {individual.address.line2 && (
                <View style={styles.preferenceItem}>
                  <Text style={styles.preferenceLabel}>Address Line 2</Text>
                  <Text style={styles.preferenceValue}>
                    {individual.address.line2}
                  </Text>
                </View>
              )}
              <View style={styles.preferenceItem}>
                <Text style={styles.preferenceLabel}>City</Text>
                <Text style={styles.preferenceValue}>
                  {individual.address.city}
                </Text>
              </View>
              <View style={styles.preferenceItem}>
                <Text style={styles.preferenceLabel}>Post Code</Text>
                <Text style={styles.preferenceValue}>
                  {individual.address.postal_code}
                </Text>
              </View>
            </AnimatedSection>
          </View>
        </View>

        <Text style={styles.disclaimer}>
          By submitting this information, you confirm that all details are
          accurate and consent to Stripe using this information for verification
          purposes.
        </Text>
      </ScrollView>

      <View style={styles.stickyButtonContainer}>
        <SubmitButton
          title={isSubmitting ? "Submitting..." : "Continue"}
          onPress={handleSubmit}
          isLoading={isSubmitting}
          disabled={isSubmitting}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.black,
  },
  scrollView: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  headerContent: {
    alignItems: "center",
    marginBottom: spacing.md,
  },
  title: {
    color: colors.text.primary,
    fontSize: 28,
    fontFamily: typography.fontFamily.semibold,
    textAlign: "center",
  },
  description: {
    color: colors.text.secondary,
    textAlign: "center",
    marginBottom: spacing.md,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSizes.md,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.md,
  },
  summaryOuterContainer: {
    width: "100%",
  },
  summaryInnerContainer: {
    backgroundColor: colors.neutral.black,
    borderRadius: 12,
  },
  sectionContainer: {
    marginBottom: spacing.lg,
    backgroundColor: colors.neutral.surface,
    borderRadius: 8,
    padding: spacing.md,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.surface,
  },
  sectionTitle: {
    color: colors.primary.yellow,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSizes.md,
  },
  preferenceItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
    paddingVertical: spacing.xs,
  },
  preferenceLabel: {
    color: colors.text.secondary,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSizes.sm,
    width: "35%",
  },
  preferenceValue: {
    color: colors.text.primary,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSizes.sm,
    flex: 1,
    textAlign: "right",
  },
  editContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  editText: {
    color: colors.text.secondary,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSizes.sm,
    marginRight: spacing.xs,
  },
  disclaimer: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.sm,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: spacing.sm,
  },
  stickyButtonContainer: {
    padding: spacing.lg,
    backgroundColor: colors.neutral.black,
  },
});
