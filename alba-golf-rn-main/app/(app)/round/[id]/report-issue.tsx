import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "@/constants/theme";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { useComplaints } from "@/hooks/useComplaints";
import { ComplaintType } from "@/types/complaints";

const COMPLAINT_TYPES = [
  {
    value: "ORGANISER_DID_NOT_BOOK" as ComplaintType,
    label: "Organiser did not book the tee time",
    description: "The organiser failed to book the actual tee time",
  },
  {
    value: "GAME_CANCELLED_WITHOUT_NOTICE" as ComplaintType,
    label: "Round cancelled without notice",
    description: "The round was cancelled without proper notification",
  },
  {
    value: "OTHER" as ComplaintType,
    label: "Other issue",
    description: "Any other problem with the round",
  },
];

export default function ReportIssuePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { submitComplaint, isSubmitting } = useComplaints(id as string);

  const [selectedType, setSelectedType] = useState<ComplaintType | null>(null);
  const [description, setDescription] = useState("");
  const [isInputFocused, setIsInputFocused] = useState(false);

  const handleOptionPress = (type: ComplaintType) => {
    setSelectedType(type);
  };

  const handleSubmit = async () => {
    if (!selectedType) {
      Alert.alert("Error", "Please select a complaint type");
      return;
    }
    if (!description.trim()) {
      Alert.alert("Error", "Please provide a description for your complaint");
      return;
    }
    const success = await submitComplaint({
      type: selectedType,
      description: description.trim(),
    });
    if (success) {
      router.back();
    }
  };

  const showForm = !!selectedType;

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      <Stack.Screen
        options={{
          title: "Report an Issue",
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ padding: 8 }}
            >
              <Ionicons
                name="arrow-back"
                size={24}
                color={colors.text.primary}
              />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        <View style={styles.headerSection}>
          <Text style={styles.headerTitle}>Report an Issue</Text>
          <Text style={styles.headerSubtitle}>
            Help us understand what went wrong with this round
          </Text>
        </View>

        {/* Options Card */}
        {!isInputFocused && (
          <View style={styles.optionsCard}>
            {COMPLAINT_TYPES.filter((t) => t.value !== "OTHER").map(
              (type, idx, arr) => (
                <React.Fragment key={type.value}>
                  <TouchableOpacity
                    style={[
                      styles.optionRow,
                      selectedType === type.value && styles.optionRowSelected,
                    ]}
                    onPress={() => handleOptionPress(type.value)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        selectedType === type.value &&
                          styles.optionTextSelected,
                      ]}
                    >
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                  {idx < arr.length - 1 && <View style={styles.divider} />}
                </React.Fragment>
              )
            )}
            {/* Other option row */}
            <View style={styles.divider} />
            <TouchableOpacity
              style={[
                styles.optionRow,
                selectedType === "OTHER" && styles.optionRowSelected,
              ]}
              onPress={() => handleOptionPress("OTHER")}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.optionText,
                  selectedType === "OTHER" && styles.optionTextSelected,
                ]}
              >
                Other
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Show form for any selected option */}
        {showForm && (
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Tell us more</Text>
            <View style={styles.inputSection}>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Let us know what went wrong"
                placeholderTextColor={colors.text.secondary}
                multiline
                numberOfLines={8}
                maxLength={500}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
              />
              <Text style={styles.characterCount}>
                {description.length}/500
              </Text>
            </View>
            <View style={styles.buttonSection}>
              <SubmitButton
                title="Submit Complaint"
                onPress={handleSubmit}
                isLoading={isSubmitting}
                disabled={!description.trim()}
              />
            </View>
          </View>
        )}
      </ScrollView>
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
  content: {
    padding: spacing.lg,
  },
  headerSection: {
    marginBottom: spacing.lg,
    paddingVertical: spacing.sm,
  },
  headerTitle: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.fontSizes.xl,
    color: colors.text.primary,
    marginBottom: spacing.xs,
    letterSpacing: -1,
  },
  headerSubtitle: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSizes.md,
    color: colors.text.secondary,
  },
  optionsCard: {
    backgroundColor: colors.neutral.black,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.text.primary,
    marginBottom: spacing.xl,
    overflow: "hidden",
  },
  optionRow: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    backgroundColor: "transparent",
  },
  optionRowSelected: {
    backgroundColor: colors.text.primary,
  },
  optionText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSizes.md,
    color: colors.text.primary,
  },
  optionTextSelected: {
    color: colors.neutral.black,
    fontWeight: "bold",
  },
  divider: {
    height: 1,
    backgroundColor: colors.neutral.surface,
    marginLeft: spacing.lg,
  },
  formSection: {
    flex: 1,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.fontSizes.lg,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  inputSection: {
    marginTop: spacing.sm,
  },
  inputLabel: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.fontSizes.md,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  textInput: {
    backgroundColor: colors.neutral.black,
    borderRadius: spacing.sm,
    padding: spacing.md,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSizes.md,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.text.primary,
  },
  textArea: {
    height: 200,
    textAlignVertical: "top",
  },
  characterCount: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.text.secondary,
    textAlign: "right",
    marginTop: spacing.xs,
  },
  buttonSection: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
});
