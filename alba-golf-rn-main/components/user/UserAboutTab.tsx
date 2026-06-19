import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, typography, spacing } from "@/constants/theme";
import { PlayerType, GameType } from "@/api/user";
import {
  formatGeneralDisplayValue,
  getGameTypeStyle,
} from "@/utils/formatters";

const ALL_PLAYER_TYPES = Object.values(PlayerType);
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

const getPlayerTypeStyleFromPalette = (playerType: PlayerType) => {
  const index = ALL_PLAYER_TYPES.indexOf(playerType);
  return PLAYER_TYPE_STYLE_PALETTE[index % PLAYER_TYPE_STYLE_PALETTE.length];
};

interface UserAboutTabProps {
  onboarding: any;
}

export const UserAboutTab: React.FC<UserAboutTabProps> = ({ onboarding }) => {
  return (
    <>
      {/* Player Type Section */}
      {onboarding?.player_type && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Player Type</Text>
          <View style={styles.tagContainer}>
            {(() => {
              const playerTypeStyle = getPlayerTypeStyleFromPalette(
                onboarding.player_type as PlayerType
              );
              return (
                <View
                  style={[
                    styles.lozenge,
                    {
                      backgroundColor: playerTypeStyle.backgroundColor,
                      borderColor: playerTypeStyle.borderColor,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.lozengeText,
                      { color: playerTypeStyle.textColor },
                    ]}
                  >
                    {formatGeneralDisplayValue(
                      onboarding.player_type as string
                    )}
                  </Text>
                </View>
              );
            })()}
          </View>
        </View>
      )}

      {/* Game Preferences Section */}
      {onboarding?.preferences && onboarding.preferences.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Round Preferences</Text>
          <View style={styles.tagContainer}>
            {onboarding.preferences.map((pref: any, index: number) => {
              const gameTypeStyle = getGameTypeStyle(pref as string);
              return (
                <View
                  key={index}
                  style={[styles.lozenge, gameTypeStyle.lozengeStyle]}
                >
                  <Text
                    style={[styles.lozengeText, { color: colors.text.primary }]}
                  >
                    {gameTypeStyle.lozengeText}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.lg,
    fontFamily: typography.fontFamily.medium,
    marginBottom: spacing.md,
  },
  tagContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  lozenge: {
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: spacing.xl,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  lozengeText: {
    fontSize: typography.fontSizes.xs,
    fontFamily: typography.fontFamily.medium,
  },
});
