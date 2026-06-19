import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "@/constants/theme";
import { HandicapRange, PlayerType, GameType } from "@/api/user"; // Assuming enums are exported from here
import { SubmitButton } from "@/components/ui/SubmitButton";
import { getGameTypeStyle } from "@/utils/formatters"; // Adjust path if necessary

export interface PlayerPreferenceFilters {
  handicapRanges?: HandicapRange[];
  playerTypes?: PlayerType[];
  preferences?: GameType[];
}

interface PlayerPreferencesModalProps {
  visible: boolean;
  onClose: () => void;
  onApplyFilters: (filters: PlayerPreferenceFilters) => void;
  initialFilters?: PlayerPreferenceFilters;
}

const ALL_HANDICAP_RANGES = Object.values(HandicapRange);
const ALL_PLAYER_TYPES = Object.values(PlayerType);
const ALL_GAME_TYPES = Object.values(GameType);

const PLAYER_TYPE_STYLE_PALETTE = [
  {
    backgroundColor: "#4A4129",
    borderColor: colors.primary.yellow,
    textColor: colors.text.primary,
  },
  {
    backgroundColor: "#4F362A",
    borderColor: colors.primary.orange,
    textColor: colors.text.primary,
  },
  {
    backgroundColor: "#442222",
    borderColor: colors.primary.red,
    textColor: colors.text.primary,
  },
  {
    backgroundColor: "#4D3240",
    borderColor: colors.primary.pink,
    textColor: colors.text.primary,
  },
];

// Helper to get a style for a player type (cycles through the palette)
const getPlayerTypeStyleFromPalette = (playerType: PlayerType) => {
  const index = ALL_PLAYER_TYPES.indexOf(playerType);
  return PLAYER_TYPE_STYLE_PALETTE[index % PLAYER_TYPE_STYLE_PALETTE.length];
};

export function PlayerPreferencesModal({
  visible,
  onClose,
  onApplyFilters,
  initialFilters = {},
}: PlayerPreferencesModalProps) {
  const [selectedHandicapRanges, setSelectedHandicapRanges] = useState<
    HandicapRange[]
  >(initialFilters.handicapRanges || []);
  const [selectedPlayerTypes, setSelectedPlayerTypes] = useState<PlayerType[]>(
    initialFilters.playerTypes || []
  );
  const [selectedPreferences, setSelectedPreferences] = useState<GameType[]>(
    initialFilters.preferences || []
  );

  useEffect(() => {
    if (visible) {
      setSelectedHandicapRanges(initialFilters.handicapRanges || []);
      setSelectedPlayerTypes(initialFilters.playerTypes || []);
      setSelectedPreferences(initialFilters.preferences || []);
    }
  }, [visible, initialFilters]);

  const handleApply = () => {
    onApplyFilters({
      handicapRanges: selectedHandicapRanges,
      playerTypes: selectedPlayerTypes,
      preferences: selectedPreferences,
    });
    onClose();
  };

  const handleReset = () => {
    setSelectedHandicapRanges([]);
    setSelectedPlayerTypes([]);
    setSelectedPreferences([]);
  };

  const toggleHandicapRange = (handicapRange: HandicapRange) => {
    setSelectedHandicapRanges((prev) =>
      prev.includes(handicapRange)
        ? prev.filter((hr) => hr !== handicapRange)
        : [...prev, handicapRange]
    );
  };

  const togglePlayerType = (playerType: PlayerType) => {
    setSelectedPlayerTypes((prev) =>
      prev.includes(playerType)
        ? prev.filter((pt) => pt !== playerType)
        : [...prev, playerType]
    );
  };

  const togglePreference = (preference: GameType) => {
    setSelectedPreferences((prev) =>
      prev.includes(preference)
        ? prev.filter((p) => p !== preference)
        : [...prev, preference]
    );
  };

  const formatEnumText = (text: string) => {
    return text
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>Filter Golfers</Text>
          <TouchableOpacity
            onPress={handleReset}
            style={styles.resetButtonHeader}
          >
            <Text style={styles.resetButtonHeaderText}>Reset</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          <Text style={styles.sectionTitle}>Handicap Range</Text>
          <View style={styles.optionGroup}>
            {ALL_HANDICAP_RANGES.map((range) => {
              const isSelected = selectedHandicapRanges.includes(range);
              return (
                <TouchableOpacity
                  key={range}
                  style={[
                    styles.optionButton,
                    isSelected && styles.selectedOptionButton,
                  ]}
                  onPress={() => toggleHandicapRange(range)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      isSelected && styles.selectedOptionButton,
                    ]}
                  >
                    {formatEnumText(range)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Player Type Filter - updated for multi-select */}
          <Text style={styles.sectionTitle}>Player Type</Text>
          <View style={styles.optionGroup}>
            {ALL_PLAYER_TYPES.map((type) => {
              const isSelected = selectedPlayerTypes.includes(type);
              let playerTypeSpecificStyle = {};
              let playerTypeTextSpecificStyle = {};

              if (isSelected) {
                const styleInfo = getPlayerTypeStyleFromPalette(type);
                playerTypeSpecificStyle = {
                  backgroundColor: styleInfo.backgroundColor,
                  borderColor: styleInfo.borderColor,
                };
                playerTypeTextSpecificStyle = { color: styleInfo.textColor };
              }

              return (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.optionButton,
                    isSelected && playerTypeSpecificStyle,
                  ]}
                  onPress={() => togglePlayerType(type)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      isSelected && styles.selectedOptionText,
                      isSelected && playerTypeTextSpecificStyle,
                    ]}
                  >
                    {formatEnumText(type)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Game Preferences Filter */}
          <Text style={styles.sectionTitle}>Game Preferences</Text>
          <View style={styles.optionGroup}>
            {ALL_GAME_TYPES.map((preference) => {
              const isSelected = selectedPreferences.includes(preference);
              let gameTypeStyle = {};

              if (isSelected) {
                const styleFromFormatter = getGameTypeStyle(preference);
                gameTypeStyle = styleFromFormatter.lozengeStyle;
              }

              return (
                <TouchableOpacity
                  key={preference}
                  style={[
                    styles.optionButton,
                    isSelected && gameTypeStyle,
                    isSelected &&
                      !gameTypeStyle.hasOwnProperty("borderColor") &&
                      styles.selectedOptionButtonGenericBorder,
                  ]}
                  onPress={() => togglePreference(preference)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      isSelected && styles.selectedOptionText,
                    ]}
                  >
                    {formatEnumText(preference)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <SubmitButton title="Apply Filters" onPress={handleApply} fullWidth />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.black,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === "ios" ? spacing.xxl : spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.surface,
  },
  closeButton: {
    width: 50, // Increased tap area
    height: 40,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  resetButtonHeader: {
    width: 50, // Increased tap area
    height: 40,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  resetButtonHeaderText: {
    color: colors.primary.yellow,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.medium,
  },
  title: {
    fontSize: typography.fontSizes.lg,
    fontFamily: typography.fontFamily.semibold,
    color: colors.text.primary,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  optionGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: spacing.lg,
  },
  optionButton: {
    backgroundColor: colors.neutral.surface,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.xl,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.neutral.surface,
  },
  selectedOptionButton: {
    backgroundColor: colors.primary.yellow,
    borderColor: colors.primary.yellow,
    color: colors.neutral.black,
  },
  selectedOptionButtonGenericBorder: {
    borderColor: colors.primary.yellow,
  },
  optionText: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.xs,
    fontFamily: typography.fontFamily.regular,
  },
  selectedOptionText: {
    fontFamily: typography.fontFamily.medium,
    color: colors.text.primary, // Default to black text for selected items (e.g., for yellow bg)
  },
  footer: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
});
