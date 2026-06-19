import React, { useRef, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "@/constants/theme";
import { SubmitButton } from "./SubmitButton";
import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { ComplaintType } from "@/types/complaints";

// This component is no longer used as we've moved to a dedicated page
// Keeping it here for potential future use

interface ComplaintModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSubmit: (data: {
    type: ComplaintType;
    title: string;
    description?: string;
  }) => void;
  isLoading?: boolean;
}

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

// Commented out since we're using a dedicated page instead
/*
export const ComplaintModal: React.FC<ComplaintModalProps> = ({
  isVisible,
  onClose,
  onSubmit,
  isLoading = false,
}) => {
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ["75%"], []);

  const [selectedType, setSelectedType] = useState<ComplaintType | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = () => {
    if (!selectedType) {
      Alert.alert("Error", "Please select a complaint type");
      return;
    }

    if (!title.trim()) {
      Alert.alert("Error", "Please provide a title for your complaint");
      return;
    }

    onSubmit({
      type: selectedType,
      title: title.trim(),
      description: description.trim() || undefined,
    });
  };

  const resetForm = () => {
    setSelectedType(null);
    setTitle("");
    setDescription("");
  };

  // Effect to handle visibility
  React.useEffect(() => {
    if (isVisible) {
      bottomSheetRef.current?.present();
    } else {
      bottomSheetRef.current?.dismiss();
      resetForm();
    }
  }, [isVisible]);

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      onDismiss={onClose}
      backgroundStyle={{ backgroundColor: colors.neutral.surface }}
      handleIndicatorStyle={{
        backgroundColor: colors.neutral.surfaceSecondary,
      }}
    >
      <BottomSheetView style={styles.modalContentContainer}>
        <View style={styles.headerSection}>
          <Text style={styles.headerTitle}>Report an Issue</Text>
          <Text style={styles.headerSubtitle}>
            Help us understand what went wrong with this game
          </Text>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>
            What type of issue are you reporting?
          </Text>

          {COMPLAINT_TYPES.map((type) => (
            <TouchableOpacity
              key={type.value}
              style={[
                styles.typeOption,
                selectedType === type.value && styles.typeOptionSelected,
              ]}
              onPress={() => setSelectedType(type.value)}
            >
              <View style={styles.typeOptionContent}>
                <View style={styles.typeOptionHeader}>
                  <View style={styles.radioContainer}>
                    <View
                      style={[
                        styles.radioButton,
                        selectedType === type.value &&
                          styles.radioButtonSelected,
                      ]}
                    >
                      {selectedType === type.value && (
                        <View style={styles.radioButtonInner} />
                      )}
                    </View>
                  </View>
                  <View style={styles.typeOptionText}>
                    <Text style={styles.typeOptionLabel}>{type.label}</Text>
                    <Text style={styles.typeOptionDescription}>
                      {type.description}
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}

          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>
              Brief title for your complaint *
            </Text>
            <TextInput
              style={styles.textInput}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g., Organiser didn't show up"
              placeholderTextColor={colors.text.secondary}
              maxLength={100}
            />
            <Text style={styles.characterCount}>{title.length}/100</Text>
          </View>

          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Additional details (optional)</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Provide any additional context or details..."
              placeholderTextColor={colors.text.secondary}
              multiline
              numberOfLines={4}
              maxLength={500}
            />
            <Text style={styles.characterCount}>{description.length}/500</Text>
          </View>
        </View>

        <View style={styles.buttonSection}>
          <SubmitButton
            title="Submit Complaint"
            onPress={handleSubmit}
            isLoading={isLoading}
            disabled={!selectedType || !title.trim()}
          />
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
};
*/

const styles = StyleSheet.create({
  modalContentContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
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
  formSection: {
    flex: 1,
  },
  sectionTitle: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.fontSizes.lg,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  typeOption: {
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: spacing.sm,
    backgroundColor: colors.neutral.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.neutral.surfaceSecondary,
  },
  typeOptionSelected: {
    borderColor: colors.primary.yellow,
    backgroundColor: colors.neutral.surfaceSecondary,
  },
  typeOptionContent: {
    flex: 1,
  },
  typeOptionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  radioContainer: {
    marginRight: spacing.sm,
    marginTop: 2,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.text.secondary,
    justifyContent: "center",
    alignItems: "center",
  },
  radioButtonSelected: {
    borderColor: colors.primary.yellow,
  },
  radioButtonInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary.yellow,
  },
  typeOptionText: {
    flex: 1,
  },
  typeOptionLabel: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.fontSizes.md,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  typeOptionDescription: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.text.secondary,
  },
  inputSection: {
    marginTop: spacing.lg,
  },
  inputLabel: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.fontSizes.md,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  textInput: {
    backgroundColor: colors.neutral.surfaceSecondary,
    borderRadius: spacing.sm,
    padding: spacing.md,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSizes.md,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.neutral.surfaceSecondary,
  },
  textArea: {
    height: 100,
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
