import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "@/constants/theme";
import { GameDetail } from "@/hooks/useGameDetail";
import JoinRequestCard, {
  JoinRequestPlayer,
} from "@/components/ui/JoinRequestCard";
import PlayerPaymentStatusCard from "@/components/ui/PlayerPaymentStatusCard";

interface OrganizerViewProps {
  game: GameDetail;
  pendingJoinRequests: GameDetail["players"];
  approvedOrConfirmedPlayers: GameDetail["players"];
  playersNeededToDisplay: number;
  hasAttemptedBooking: boolean;
  onPlayerStatusUpdate: (
    playerId: string,
    status: "APPROVED" | "REJECTED"
  ) => void;
  onViewProfile: (playerId: string) => void;
  onOpenConfirmBookingModal: () => void;
  onResetBookingAttempt: () => void;
  onShare: () => void;
}

export const OrganizerView: React.FC<OrganizerViewProps> = ({
  game,
  pendingJoinRequests,
  approvedOrConfirmedPlayers,
  playersNeededToDisplay,
  hasAttemptedBooking,
  onPlayerStatusUpdate,
  onViewProfile,
  onOpenConfirmBookingModal,
  onResetBookingAttempt,
  onShare,
}) => {
  const showOrganizerBookTeeTimeLayout =
    game.status === "READY_TO_BOOK" && !hasAttemptedBooking;

  const showOrganizerConfirmBookingLayout =
    game.status === "READY_TO_BOOK" && hasAttemptedBooking;

  const shareButton =
    playersNeededToDisplay > 0 ? (
      <TouchableOpacity
        style={styles.shareButton}
        onPress={onShare}
        activeOpacity={0.85}
      >
        <Ionicons
          name="share-outline"
          size={20}
          color={colors.neutral.black}
        />
        <Text style={styles.shareButtonText}>Share to invite players</Text>
      </TouchableOpacity>
    ) : null;

  // Payment status section for READY games
  if (game.status === "READY" && approvedOrConfirmedPlayers.length > 0) {
    return (
      <View style={styles.paymentStatusListSection}>
        <Text style={styles.paymentStatusTitle}>Payment Status</Text>
        <FlatList
          data={approvedOrConfirmedPlayers.filter(
            (player) => player.user_id !== game.creator_id
          )}
          renderItem={({ item }) => <PlayerPaymentStatusCard player={item} />}
          keyExtractor={(item) => item.user_id}
          scrollEnabled={false}
        />
      </View>
    );
  }

  // Confirm booking layout
  if (showOrganizerConfirmBookingLayout) {
    return (
      <View style={styles.statusInfoSection}>
        <Text style={styles.statusInfoTitleText}>Have you booked?</Text>
        <View style={styles.confirmBookingActionsContainer}>
          <TouchableOpacity
            style={[
              styles.confirmBookingButton,
              styles.confirmBookingYesButton,
            ]}
            onPress={onOpenConfirmBookingModal}
          >
            <Ionicons
              name="checkmark-outline"
              size={32}
              color={colors.neutral.white}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.confirmBookingButton, styles.confirmBookingNoButton]}
            onPress={onResetBookingAttempt}
          >
            <Ionicons
              name="close-outline"
              size={32}
              color={colors.neutral.white}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Book tee time layout
  if (showOrganizerBookTeeTimeLayout) {
    return (
      <View style={styles.statusInfoSection}>
        <Text style={styles.statusInfoTitleText}>Team locked in!</Text>
        <Text style={styles.statusInfoSubtitleText}>
          Time to book a round for your team.
        </Text>
      </View>
    );
  }

  // Pending join requests
  if (pendingJoinRequests.length > 0) {
    return (
      <View style={styles.requestsSection}>
        {shareButton}
        <Text style={styles.requestsTitle}>Requests to join</Text>
        <FlatList
          data={pendingJoinRequests}
          renderItem={({ item }) => (
            <JoinRequestCard
              player={item as JoinRequestPlayer}
              onAccept={() => onPlayerStatusUpdate(item.user_id, "APPROVED")}
              onDecline={() => onPlayerStatusUpdate(item.user_id, "REJECTED")}
              onViewProfile={() => onViewProfile(item.user_id)}
            />
          )}
          keyExtractor={(item) => item.user_id}
          scrollEnabled={false}
        />
      </View>
    );
  }

  // COMPLETED state
  if (game.status === "COMPLETED") {
    return (
      <View style={styles.statusInfoSection}>
        <Text style={styles.statusInfoTitleText}>Round Completed</Text>
        <Text style={styles.statusInfoSubtitleText}>
          This round has been played.
        </Text>
      </View>
    );
  }

  // Default waiting state
  return (
    <View style={styles.waitingSection}>
      <Text style={styles.waitingText}>No pending requests right now.</Text>
      {playersNeededToDisplay > 0 && (
        <Text style={styles.subWaitingText}>
          Still waiting for {playersNeededToDisplay} more{" "}
          {playersNeededToDisplay === 1 ? "player" : "players"}.
        </Text>
      )}
      {shareButton}
    </View>
  );
};

const styles = StyleSheet.create({
  statusInfoSection: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderRadius: spacing.md,
    marginBottom: spacing.lg,
  },
  statusInfoTitleText: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.xl,
    fontFamily: typography.fontFamily.semibold,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  statusInfoSubtitleText: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
    textAlign: "center",
  },
  requestsSection: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  requestsTitle: {
    fontSize: typography.fontSizes.xxl,
    fontFamily: typography.fontFamily.light,
    color: colors.text.primary,
    marginBottom: spacing.md,
    letterSpacing: -1.5,
    paddingHorizontal: spacing.sm,
  },
  waitingSection: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.sm,
  },
  waitingText: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.xl,
    fontFamily: typography.fontFamily.semibold,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  subWaitingText: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
    textAlign: "center",
  },
  confirmBookingActionsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: spacing.lg,
    width: "60%",
  },
  confirmBookingButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: "center",
    alignItems: "center",
  },
  confirmBookingYesButton: {
    backgroundColor: colors.semantic.success,
  },
  confirmBookingNoButton: {
    backgroundColor: colors.semantic.error,
  },
  paymentStatusTitle: {
    fontSize: typography.fontSizes.xxl,
    fontFamily: typography.fontFamily.light,
    color: colors.text.primary,
    marginBottom: spacing.md,
    letterSpacing: -1.5,
    paddingHorizontal: spacing.sm,
  },
  paymentStatusListSection: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch",
    backgroundColor: colors.primary.yellow,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  shareButtonText: {
    color: colors.neutral.black,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.semibold,
  },
});
