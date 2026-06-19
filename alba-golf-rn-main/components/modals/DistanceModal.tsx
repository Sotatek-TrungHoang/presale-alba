import React from "react";
import { Modal, View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { colors, spacing, typography } from "@/constants/theme";
import Slider from "@react-native-community/slider";
import { SubmitButton } from "@/components/ui/SubmitButton";

interface DistanceModalProps {
  visible: boolean;
  onClose: () => void;
  onApplyDistance: (distance: number) => void;
  initialDistance: number;
  // Distance applied by the "Reset" button. Also the value the slider
  // is treated as representing when initialDistance exceeds the slider's max.
  defaultDistance?: number;
}

const SLIDER_MAX = 50;

export function DistanceModal({
  visible,
  onClose,
  onApplyDistance,
  initialDistance,
  defaultDistance = 50,
}: DistanceModalProps) {
  const [distance, setDistance] = React.useState(
    Math.min(initialDistance, SLIDER_MAX)
  );

  React.useEffect(() => {
    if (visible) {
      setDistance(Math.min(initialDistance, SLIDER_MAX));
    }
  }, [visible, initialDistance]);

  const handleApply = () => {
    onApplyDistance(distance);
    onClose();
  };

  const handleReset = () => {
    setDistance(Math.min(defaultDistance, SLIDER_MAX));
    onApplyDistance(defaultDistance);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Set Distance</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.distanceContainer}>
            <Text style={styles.distanceValue}>{Math.round(distance)}km</Text>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={50}
              value={distance}
              onValueChange={(value) => setDistance(Math.round(value))}
              step={1}
              minimumTrackTintColor={colors.primary.yellow}
              maximumTrackTintColor={colors.neutral.surface}
              thumbTintColor={colors.primary.yellow}
            />
            <View style={styles.rangeLabels}>
              <Text style={styles.rangeText}>0km</Text>
              <Text style={styles.rangeText}>50km</Text>
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity onPress={handleReset} style={styles.resetButton}>
              <Text style={styles.resetText}>Reset distance</Text>
            </TouchableOpacity>
            <SubmitButton title="Apply" onPress={handleApply} fullWidth />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.neutral.black,
    borderRadius: 20,
    padding: spacing.lg,
    width: "100%",
    maxWidth: 400,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: typography.fontSizes.lg,
    fontFamily: typography.fontFamily.semibold,
    color: colors.text.primary,
  },
  closeButton: {
    padding: spacing.sm,
  },
  closeText: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
  },
  distanceContainer: {
    marginBottom: spacing.xl,
  },
  distanceValue: {
    fontSize: typography.fontSizes.xxl,
    fontFamily: typography.fontFamily.semibold,
    color: colors.primary.yellow,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  slider: {
    width: "100%",
    height: 40,
  },
  rangeLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  rangeText: {
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.text.secondary,
  },
  footer: {
    marginTop: spacing.xl,
  },
  resetButton: {
    alignItems: "center",
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  resetText: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
  },
});
