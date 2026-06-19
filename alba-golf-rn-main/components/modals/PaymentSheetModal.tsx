import React, { useRef, useMemo, useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "@/constants/theme";
import { SubmitButton } from "../ui/SubmitButton";
import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { useStripe } from "@stripe/stripe-react-native";
import * as Sentry from "@sentry/react-native";
import {
  createGamePaymentIntent,
  getGamePaymentDetails,
  GamePaymentDetails,
} from "@/api/games";

interface PaymentSheetModalProps {
  isVisible: boolean;
  onClose: () => void;
  courseName?: string;
  gameDate?: string;
  exactTime?: string;
  gameId: string;
  onPaymentSuccess?: () => void;
}

export const PaymentSheetModal: React.FC<PaymentSheetModalProps> = ({
  isVisible,
  onClose,
  courseName,
  gameDate,
  exactTime,
  gameId,
  onPaymentSuccess,
}) => {
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const isPresentingRef = useRef(false);
  const isVisibleRef = useRef(isVisible);
  const snapPoints = useMemo(() => ["45%"], []);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [fetchingDetails, setFetchingDetails] = useState(false);

  const [paymentDetails, setPaymentDetails] =
    useState<GamePaymentDetails | null>(null);

  const formatCurrency = (amount: number) => {
    return `£${(amount / 100).toFixed(2)}`;
  };

  const fetchPaymentDetails = useCallback(async () => {
    try {
      setFetchingDetails(true);
      const details = await getGamePaymentDetails(gameId);
      setPaymentDetails(details);
    } catch (error) {
      console.error("Error fetching payment details:", error);
      Alert.alert(
        "Error",
        "There was an error fetching the payment details. Please try again later."
      );
      onClose();
    } finally {
      setFetchingDetails(false);
    }
  }, [gameId, onClose]);

  const initializePaymentSheet = async () => {
    if (!paymentDetails) {
      Alert.alert(
        "Error",
        "There was an error fetching the payment details. Please try again later."
      );
      return false;
    }

    try {
      setPaymentLoading(true);
      const { clientSecret, ephemeralKey, customerId } =
        await createGamePaymentIntent(gameId);

      const { error } = await initPaymentSheet({
        merchantDisplayName: "Alba Golf",
        customerId: customerId,
        customerEphemeralKeySecret: ephemeralKey,
        paymentIntentClientSecret: clientSecret,
        // Customize the appearance
        appearance: {
          colors: {
            primary: colors.primary.yellow,
            background: colors.neutral.surface,
            componentBackground: colors.neutral.surfaceSecondary,
            componentText: colors.text.primary,
          },
        },
        defaultBillingDetails: {
          name: "Alba Golf App Payment",
        },
      });

      if (error) {
        console.error("Error initializing payment sheet:", error);
        Alert.alert(
          "Payment Setup Error",
          "There was an error setting up the payment. Please try again later."
        );
        onClose();
        return false;
      }
      return true;
    } catch (error) {
      console.error("Error in initializePaymentSheet:", error);
      const apiError = error as any;
      Alert.alert(
        "Service Unavailable",
        apiError.response?.data.message ||
          "The payment service is currently unavailable. Please try again later."
      );
      onClose();
      return false;
    }
  };

  const handlePayment = async () => {
    if (isPresentingRef.current) return;
    isPresentingRef.current = true;
    try {
      setPaymentLoading(true);

      const initialized = await initializePaymentSheet();
      if (!initialized) return;

      // Presenting against a host VC that's mid-dismiss raises an NSException
      // and aborts the app from the TurboModule queue.
      if (!isVisibleRef.current) return;

      Sentry.addBreadcrumb({
        category: "payment",
        message: "presentPaymentSheet",
        level: "info",
        data: { gameId },
      });

      const { error } = await presentPaymentSheet();

      if (error) {
        if (error.code === "Canceled") return;
        console.error("Payment error:", error);
        Alert.alert(
          "Payment Failed",
          error.message ||
            "There was an error processing your payment. Please try again."
        );
      } else {
        Alert.alert(
          "Success",
          "Your payment was successful! You're all set for the round."
        );
        onClose();
        if (onPaymentSuccess) {
          onPaymentSuccess();
        }
      }
    } catch (error) {
      console.error("Error in handlePayment:", error);
      Sentry.captureException(error, { tags: { feature: "payment-sheet" } });
      Alert.alert(
        "Payment Error",
        "There was an error processing your payment. Please try again."
      );
    } finally {
      setPaymentLoading(false);
      isPresentingRef.current = false;
    }
  };

  // Effect to handle visibility
  React.useEffect(() => {
    isVisibleRef.current = isVisible;
    if (isVisible) {
      bottomSheetRef.current?.present();
      // When the modal becomes visible, fetch the payment details
      fetchPaymentDetails();
    } else {
      bottomSheetRef.current?.dismiss();
      setPaymentDetails(null);
    }
  }, [isVisible, fetchPaymentDetails]);

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
          <Text style={styles.courseNameText}>
            {courseName || "Golf Course"}
          </Text>
          <View style={styles.dateTimeRow}>
            <Text style={styles.dateText}>{gameDate || "Date"}</Text>
            {exactTime && (
              <View style={styles.timeRow}>
                <Ionicons
                  name="time-outline"
                  size={16}
                  color={colors.text.secondary}
                  style={styles.timeIcon}
                />
                <Text style={styles.timeText}>{exactTime}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.feesSection}>
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Tee Fee</Text>
            <Text style={styles.feeAmount}>
              {paymentDetails?.playerShare
                ? formatCurrency(paymentDetails.playerShare)
                : "..."}
            </Text>
          </View>
          <View style={styles.feeRow}>
            <View style={styles.protectionFeeLabelContainer}>
              <Text style={styles.feeLabel}>Golfer Protection Fee</Text>
              <TouchableOpacity
                onPress={() => alert("Golfer Protection details...")}
                style={styles.infoIconContainer}
              >
              </TouchableOpacity>
            </View>
            <Text style={styles.feeAmount}>
              {paymentDetails?.applicationFee
                ? formatCurrency(paymentDetails.applicationFee)
                : "..."}
            </Text>
          </View>
        </View>

        <View style={styles.totalSection}>
          <Text style={styles.totalLabel}>Total to pay</Text>
          <Text style={styles.totalAmount}>
            {paymentDetails?.totalAmount
              ? formatCurrency(paymentDetails.totalAmount)
              : "..."}
          </Text>
        </View>

        <View style={styles.paymentButtonContainer}>
          <SubmitButton
            title="Proceed to Payment"
            onPress={handlePayment}
            isLoading={paymentLoading}
          />
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  modalContentContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  headerSection: {
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
  },
  courseNameText: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.fontSizes.xl,
    color: colors.text.primary,
    marginBottom: spacing.xs,
    letterSpacing: -1,
  },
  dateTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  dateText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSizes.md,
    color: colors.primary.yellow,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  timeIcon: {
    marginRight: spacing.xs / 2,
  },
  timeText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSizes.md,
    color: colors.text.primary,
  },
  feesSection: {
    marginBottom: spacing.sm,
  },
  feeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  protectionFeeLabelContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  feeLabel: {
    fontFamily: typography.fontFamily.light,
    fontSize: typography.fontSizes.lg,
    color: colors.text.primary,
  },
  infoIconContainer: {
    marginLeft: spacing.xs,
  },
  feeAmount: {
    fontFamily: typography.fontFamily.light,
    fontSize: typography.fontSizes.lg,
    color: colors.text.primary,
  },
  totalSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  totalLabel: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.fontSizes.lg,
    color: colors.text.primary,
  },
  totalAmount: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSizes.lg,
    color: colors.text.primary,
  },
  paymentButtonContainer: {
    marginBottom: spacing.md,
  },
  // Styles for Apple Pay like button (if you want to visually mock it)
  // applePayButton: {
  //   backgroundColor: colors.neutral.black, // Or Apple's black
  //   borderRadius: spacing.sm,
  //   height: 50,
  //   justifyContent: 'center',
  //   alignItems: 'center',
  // },
  // applePayButtonText: {
  //   color: colors.neutral.white,
  //   fontFamily: typography.fontFamily.semibold,
  //   fontSize: typography.fontSizes.lg,
  // },
});
