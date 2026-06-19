import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "@/constants/theme";
import { SubmitButton } from "./SubmitButton";
import { UpdateGameDto, updateGame } from "@/api/games";

interface GameCourse {
  id: string;
  name: string;
}

interface EditGameModalProps {
  isVisible: boolean;
  onClose: () => void;
  gameId: string;
  currentData: {
    course?: GameCourse | null;
    name?: string | null;
    date: string;
    time_slot: string;
    players_needed: number;
    game_type: string;
    game_format?: string | null;
    status?: string;
  };
  onGameUpdated: () => void;
}

const timeSlotOptions = [
  { value: "EARLY_MORNING", label: "Early Morning (6:00 - 9:00)" },
  { value: "LATE_MORNING", label: "Late Morning (9:00 - 12:00)" },
  { value: "LUNCHTIME", label: "Lunchtime (12:00 - 15:00)" },
  { value: "LATE_AFTERNOON", label: "Late Afternoon (15:00 - 18:00)" },
];

const gameTypeOptions = [
  { value: "PURELY_SOCIAL", label: "Purely Social" },
  { value: "RELAXED_ROUND", label: "Relaxed Round" },
  { value: "COMPETITIVE_MATCH", label: "Competitive Match" },
  { value: "BEGINNER_FRIENDLY", label: "Beginner Friendly" },
];

const gameFormatOptions = [
  { value: "MATCHPLAY", label: "Matchplay" },
  { value: "STROKEPLAY", label: "Strokeplay" },
  { value: "SCRAMBLE", label: "Scramble" },
  { value: "STABLEFORD", label: "Stableford" },
  { value: "BEST_BALL", label: "Best Ball" },
  { value: "DONT_KNOW_YET", label: "Don't Know Yet" },
];

const playersNeededOptions = [
  { value: 2, label: "2 players" },
  { value: 3, label: "3 players" },
  { value: 4, label: "4 players" },
];

export const EditGameModal: React.FC<EditGameModalProps> = ({
  isVisible,
  onClose,
  gameId,
  currentData,
  onGameUpdated,
}) => {
  const [name, setName] = useState<string>("");
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>("");
  const [selectedPlayersNeeded, setSelectedPlayersNeeded] = useState<number>(4);
  const [selectedGameType, setSelectedGameType] = useState<string>("");
  const [selectedGameFormat, setSelectedGameFormat] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  // Check if game can be edited
  const canEditGame =
    currentData.status === "PLAYERS_REQUIRED" ||
    currentData.status === "READY_TO_BOOK";

  // Initialize form data when modal opens
  useEffect(() => {
    if (isVisible && currentData) {
      // If game cannot be edited, show alert and close modal
      if (!canEditGame) {
        Alert.alert(
          "Cannot Edit Round",
          "This round cannot be edited as it has already been finalized or completed.",
          [{ text: "OK", onPress: onClose }]
        );
        return;
      }

      setName(currentData.name ?? "");
      setSelectedTimeSlot(currentData.time_slot);
      setSelectedPlayersNeeded(currentData.players_needed);
      setSelectedGameType(currentData.game_type);
      setSelectedGameFormat(currentData.game_format || "DONT_KNOW_YET");
    }
  }, [isVisible, currentData, canEditGame, onClose]);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const trimmedName = name.trim();
      const updateData: UpdateGameDto = {
        name: trimmedName.length > 0 ? trimmedName : null,
        time_slot: selectedTimeSlot as any,
        players_needed: selectedPlayersNeeded,
        game_type: selectedGameType as any,
        game_format: selectedGameFormat as any,
      };

      await updateGame(gameId, updateData);
      Alert.alert("Success", "Round updated successfully!");
      onGameUpdated();
      onClose();
    } catch (error: any) {
      console.error("Error updating round:", error);
      Alert.alert(
        "Error",
        error.message || "Failed to update round. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const renderOption = (
    options: Array<{ value: any; label: string }>,
    selectedValue: any,
    onSelect: (value: any) => void,
    title: string
  ) => (
    <View style={styles.optionSection}>
      <Text style={styles.optionTitle}>{title}</Text>
      {options.map((option) => (
        <TouchableOpacity
          key={option.value}
          style={[
            styles.optionButton,
            selectedValue === option.value && styles.selectedOptionButton,
          ]}
          onPress={() => onSelect(option.value)}
        >
          <Text
            style={[
              styles.optionButtonText,
              selectedValue === option.value && styles.selectedOptionButtonText,
            ]}
          >
            {option.label}
          </Text>
          {selectedValue === option.value && (
            <Ionicons
              name="checkmark"
              size={20}
              color={colors.neutral.black}
              style={styles.checkIcon}
            />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>Edit Round</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Name Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Name (optional)</Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder="Give this round a name"
              placeholderTextColor={colors.text.secondary}
              maxLength={60}
              returnKeyType="done"
            />
          </View>

          {/* Course Section - Read Only */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Course</Text>
            <View style={styles.readOnlyDisplay}>
              <Text style={styles.readOnlyText}>
                {currentData.course?.name || "No course selected"}
              </Text>
              <Text style={styles.readOnlyNote}>
                Course cannot be changed after round creation
              </Text>
            </View>
          </View>

          {/* Date Section - Read Only */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Date</Text>
            <View style={styles.readOnlyDisplay}>
              <Text style={styles.readOnlyText}>
                {new Date(currentData.date).toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </Text>
              <Text style={styles.readOnlyNote}>
                Date cannot be changed after round creation
              </Text>
            </View>
          </View>

          {/* Time Slot */}
          {renderOption(
            timeSlotOptions,
            selectedTimeSlot,
            setSelectedTimeSlot,
            "Time Slot"
          )}

          {/* Players Needed */}
          {renderOption(
            playersNeededOptions,
            selectedPlayersNeeded,
            setSelectedPlayersNeeded,
            "Players Needed"
          )}

          {/* Game Type */}
          {renderOption(
            gameTypeOptions,
            selectedGameType,
            setSelectedGameType,
            "Round Type"
          )}

          {/* Game Format */}
          {renderOption(
            gameFormatOptions,
            selectedGameFormat,
            setSelectedGameFormat,
            "Round Format"
          )}
        </ScrollView>

        <View style={styles.footer}>
          <SubmitButton
            title="Save Changes"
            onPress={handleSave}
            isLoading={isLoading}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.black,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === "ios" ? spacing.xxl : spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.surface,
  },
  closeButton: {
    padding: spacing.xs,
  },
  title: {
    fontSize: typography.fontSizes.xl,
    fontFamily: typography.fontFamily.light,
    color: colors.text.primary,
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.fontSizes.lg,
    fontFamily: typography.fontFamily.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  readOnlyDisplay: {
    padding: spacing.md,
    backgroundColor: colors.neutral.surface,
    borderRadius: spacing.sm,
    opacity: 0.7,
  },
  textInput: {
    padding: spacing.md,
    backgroundColor: colors.neutral.surface,
    borderRadius: spacing.sm,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
    color: colors.text.primary,
  },
  readOnlyText: {
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  readOnlyNote: {
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.text.secondary,
    fontStyle: "italic",
  },
  optionSection: {
    marginBottom: spacing.xl,
  },
  optionTitle: {
    fontSize: typography.fontSizes.lg,
    fontFamily: typography.fontFamily.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    backgroundColor: colors.neutral.surface,
    borderRadius: spacing.sm,
    marginBottom: spacing.xs,
  },
  selectedOptionButton: {
    backgroundColor: colors.primary.yellow,
  },
  optionButtonText: {
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
    color: colors.text.primary,
    flex: 1,
  },
  selectedOptionButtonText: {
    color: colors.neutral.black,
    fontFamily: typography.fontFamily.semibold,
  },
  checkIcon: {
    marginLeft: spacing.sm,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.surface,
  },
});
