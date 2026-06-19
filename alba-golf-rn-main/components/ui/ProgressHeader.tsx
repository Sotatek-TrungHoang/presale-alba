import React from "react";
import { View, StyleSheet, Text } from "react-native";
import { colors, spacing } from "@/constants/theme";

interface ProgressHeaderProps {
  currentStep: number;
  totalSteps: number;
}

export function ProgressHeader({
  currentStep,
  totalSteps,
}: ProgressHeaderProps) {
  // Calculate width percentage for the progress bar
  const progress = (currentStep / totalSteps) * 100;

  return (
    <View style={styles.container}>
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { width: `${progress}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "column",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: spacing.md,
  },
  progressContainer: {
    width: "100%",
    height: 8,
    backgroundColor: colors.neutral.surface,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: spacing.xs,
  },
  progressBar: {
    height: "100%",
    backgroundColor: colors.primary.yellow,
    borderRadius: 4,
  },
  stepText: {
    color: colors.gray[500],
    fontSize: 12,
    marginTop: 4,
  },
});

export default ProgressHeader;
