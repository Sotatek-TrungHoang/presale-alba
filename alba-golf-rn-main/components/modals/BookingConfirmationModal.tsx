import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { colors, spacing, typography } from "@/constants/theme";
import { SubmitButton } from "@/components/ui/SubmitButton";

interface BookingConfirmationModalProps {
  isVisible: boolean;
  onClose: () => void;
  onConfirm: (exactTime: string, totalCost: number) => Promise<boolean>;
  isLoading?: boolean;
}

export const BookingConfirmationModal: React.FC<
  BookingConfirmationModalProps
> = ({ isVisible, onClose, onConfirm, isLoading = false }) => {
  const [modalStage, setModalStage] = useState<"time" | "amount">("time");
  const defaultTeeTime = (() => {
    const d = new Date();
    d.setHours(9, 0, 0, 0);
    return d;
  })();
  const [selectedTeeTime, setSelectedTeeTime] = useState<Date>(defaultTeeTime);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [totalAmountPaid, setTotalAmountPaid] = useState("");

  const handleTimeChange = (event: DateTimePickerEvent, newTime?: Date) => {
    setShowTimePicker(Platform.OS === "ios");
    if (newTime) {
      setSelectedTeeTime(newTime);
    }
  };

  const handleAmountKeyPress = (key: string) => {
    if (key === "backspace") {
      setTotalAmountPaid((prev) => prev.slice(0, -1));
    } else if (totalAmountPaid.length < 7) {
      if (key === "." && totalAmountPaid.includes(".")) return;
      if (
        key !== "." &&
        totalAmountPaid.includes(".") &&
        totalAmountPaid.split(".")[1]?.length >= 2
      )
        return;
      setTotalAmountPaid((prev) => prev + key);
    }
  };

  const handleConfirmTime = () => {
    setModalStage("amount");
  };

  const handleConfirmAmount = async () => {
    if (isLoading) return; // Prevent multiple submissions

    const hours = selectedTeeTime.getHours().toString().padStart(2, "0");
    const minutes = selectedTeeTime.getMinutes().toString().padStart(2, "0");
    const exact_time = `${hours}:${minutes}`;
    const total_cost = parseFloat(totalAmountPaid);

    if (isNaN(total_cost) || total_cost <= 0) {
      return;
    }

    const success = await onConfirm(exact_time, total_cost);
    if (success) {
      // Reset modal state
      setSelectedTeeTime(new Date());
      setTotalAmountPaid("");
      setModalStage("time");
    }
  };

  const handleClose = () => {
    setSelectedTeeTime(new Date());
    setTotalAmountPaid("");
    setModalStage("time");
    onClose();
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContentContainer}>
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={handleClose}
            testID="close-button"
            accessibilityLabel="Close"
          >
            <Ionicons
              name="close-outline"
              size={30}
              color={colors.text.primary}
            />
          </TouchableOpacity>

          {modalStage === "time" && (
            <>
              <View style={styles.mainModalContentWrapper}>
                <Text style={styles.modalTitle}>Confirm Tee Time</Text>
                <Text style={styles.modalSubtitle}>
                  Please select the time you have booked to play
                </Text>
                {Platform.OS === "android" && (
                  <TouchableOpacity
                    onPress={() => setShowTimePicker(true)}
                    style={styles.timeDisplayButton}
                  >
                    <Text style={styles.timeDisplayText}>
                      {selectedTeeTime.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </TouchableOpacity>
                )}
                {(Platform.OS === "ios" || showTimePicker) && (
                  <DateTimePicker
                    value={selectedTeeTime}
                    mode="time"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={handleTimeChange}
                    textColor={colors.text.primary}
                    style={styles.dateTimePicker}
                  />
                )}
              </View>
              <SubmitButton
                title="Confirm Time"
                onPress={handleConfirmTime}
                style={styles.modalConfirmButton}
                testID="confirm-time-button"
              />
            </>
          )}

          {modalStage === "amount" && (
            <>
              <View style={styles.mainModalContentWrapper}>
                <Text style={styles.modalTitle}>Request Payment</Text>
                <Text style={styles.modalSubtitle}>
                  Tell us the total amount paid for the booking and we'll
                  request each player's share
                </Text>
                <Text style={styles.amountDisplay}>
                  £{totalAmountPaid || "0.00"}
                </Text>
                <View style={styles.keypadContainer}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, ".", 0, "backspace"].map(
                    (key) => (
                      <TouchableOpacity
                        key={key}
                        style={styles.keypadButton}
                        onPress={() => handleAmountKeyPress(key.toString())}
                        {...(key === "backspace"
                          ? {
                              testID: "backspace-button",
                              accessibilityLabel: "Backspace",
                            }
                          : {})}
                      >
                        {key === "backspace" ? (
                          <Ionicons
                            name="backspace-outline"
                            size={28}
                            color={colors.text.primary}
                          />
                        ) : (
                          <Text style={styles.keypadButtonText}>{key}</Text>
                        )}
                      </TouchableOpacity>
                    )
                  )}
                </View>
              </View>
              <SubmitButton
                title="Confirm Amount & Request"
                onPress={handleConfirmAmount}
                isLoading={isLoading}
                style={styles.modalConfirmButton}
                testID="confirm-amount-button"
              />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
  },
  modalContentContainer: {
    flex: 1,
    backgroundColor: colors.neutral.black,
    padding: spacing.lg,
    justifyContent: "space-between",
    alignItems: "stretch",
  },
  mainModalContentWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  modalCloseButton: {
    position: "absolute",
    top: Platform.OS === "ios" ? spacing.lg + spacing.md : spacing.lg,
    left: spacing.lg,
    zIndex: 1,
  },
  modalTitle: {
    fontSize: typography.fontSizes.xxl,
    fontFamily: typography.fontFamily.light,
    color: colors.text.primary,
    letterSpacing: -1.5,
    marginTop:
      Platform.OS === "ios"
        ? spacing.md + spacing.lg + spacing.sm
        : spacing.lg + spacing.sm,
    marginBottom: spacing.xs,
  },
  modalSubtitle: {
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
    color: colors.text.secondary,
    marginBottom: spacing.xl,
    textAlign: "center",
  },
  timeDisplayButton: {
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.neutral.surface,
    borderRadius: spacing.sm,
    marginBottom: spacing.md,
  },
  timeDisplayText: {
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
    color: colors.text.primary,
  },
  dateTimePicker: {
    width: "100%",
  },
  modalConfirmButton: {
    marginBottom: spacing.md,
  },
  amountDisplay: {
    fontSize: typography.fontSizes.xxxl,
    fontFamily: typography.fontFamily.light,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  keypadContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
  },
  keypadButton: {
    width: "30%",
    aspectRatio: 1.2,
    borderRadius: spacing.lg,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.sm,
    backgroundColor: colors.neutral.surface,
  },
  keypadButtonText: {
    fontSize: typography.fontSizes.xl,
    fontFamily: typography.fontFamily.semibold,
    color: colors.text.primary,
  },
});
