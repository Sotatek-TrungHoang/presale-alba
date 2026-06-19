import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "@/constants/theme";
import { GameDetail } from "@/hooks/useGameDetail";
import { GolferProtection } from "@/components/ui/GolferProtection";
import { formatTimeSlotDisplay } from "@/utils/formatters";

interface PlayerViewProps {
  game: GameDetail;
  currentUserStatusInGame: string | null;
  playersNeededToDisplay: number;
  canRequestToJoin: boolean;
  currentUserHasPaid?: boolean;
  currentUserComplaint: boolean;
  currentUserRefunded?: boolean;
}

export const PlayerView: React.FC<PlayerViewProps> = ({
  game,
  currentUserStatusInGame,
  playersNeededToDisplay,
  canRequestToJoin,
  currentUserHasPaid = false,
  currentUserComplaint,
  currentUserRefunded = false,
}) => {
  // Handle null/undefined game
  if (!game) {
    return null;
  }

  // READY state - show payment UI
  if (game.status === "READY") {
    return (
      <View style={styles.nonOrganizerReadyContainer}>
        {!currentUserComplaint && (
          <GolferProtection gameDate={game.date} testID="golfer-protection" />
        )}
        {!currentUserHasPaid && !currentUserRefunded && (
          <View style={styles.teeTimeBookedMessageContainer}>
            <Text style={styles.teeTimeBookedTitle}>Tee time booked for</Text>
            <Text style={styles.teeTimeBookedTime}>
              {game.exact_time || formatTimeSlotDisplay(game.time_slot)}
            </Text>
          </View>
        )}
        {currentUserHasPaid && !currentUserComplaint && (
          <View style={styles.paymentStatusSection}>
            <Ionicons
              name="checkmark-circle"
              size={24}
              color={colors.semantic.success}
              style={{ marginBottom: spacing.sm }}
            />
            <Text style={styles.paymentStatusTitle}>Payment Complete</Text>
            <Text style={styles.paymentStatusSubtitle}>
              You're all set for the round!
            </Text>
          </View>
        )}
      </View>
    );
  }

  // COMPLETED or CANCELLED state
  if (game.status === "COMPLETED" || game.status === "CANCELLED") {
    return (
      <View style={styles.statusInfoSection}>
        <Text style={styles.statusInfoTitleText}>
          {game.status === "COMPLETED" ? "Game Completed" : "Game Cancelled"}
        </Text>
        <Text style={styles.statusInfoSubtitleText}>
          {game.status === "COMPLETED"
            ? "This round has been played."
            : "This round has been cancelled."}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.nonOrganizerContentContainer}>
      <GolferProtection gameDate={game.date} testID="golfer-protection" />

      {currentUserStatusInGame === "PENDING" ? (
        <View style={styles.statusInfoSection}>
          <Ionicons
            name="hourglass-outline"
            size={24}
            color={colors.primary.yellow}
            style={{ marginBottom: spacing.sm }}
          />
          <Text style={styles.statusInfoTitleText}>Request Sent</Text>
          <Text style={styles.statusInfoSubtitleText}>
            {game.status === "PLAYERS_REQUIRED"
              ? "The organizer has your request and will review it shortly."
              : "The team is set! The organizer may still review late requests."}
          </Text>
        </View>
      ) : currentUserStatusInGame === "APPROVED" ||
        currentUserStatusInGame === "CONFIRMED" ? (
        <View style={styles.statusInfoSection}>
          <Ionicons
            name="checkmark-circle-outline"
            size={24}
            color={colors.semantic.success}
            style={{ marginBottom: spacing.sm }}
          />
          {game.status === "PLAYERS_REQUIRED" ? (
            <>
              <Text style={styles.statusInfoTitleText}>You're In!</Text>
              <Text style={styles.statusInfoSubtitleText}>
                You are confirmed for this game.
              </Text>
              {playersNeededToDisplay > 0 && (
                <Text style={styles.statusInfoSubtitleText}>
                  Waiting for {playersNeededToDisplay} more{" "}
                  {playersNeededToDisplay === 1 ? "player" : "players"} to join.
                </Text>
              )}
            </>
          ) : game.status === "READY_TO_BOOK" ? (
            <>
              <Text style={styles.statusInfoTitleText}>Team locked in!</Text>
              <Text style={styles.statusInfoSubtitleText}>
                You are confirmed for this round. Waiting for the organizer to
                book the tee time.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.statusInfoTitleText}>You're Confirmed!</Text>
            </>
          )}
        </View>
      ) : currentUserStatusInGame === "REJECTED" ? (
        <View style={styles.statusInfoSection}>
          <Ionicons
            name="close-circle-outline"
            size={24}
            color={colors.semantic.error}
            style={{ marginBottom: spacing.sm }}
          />
          <Text style={styles.statusInfoTitleText}>Request Declined</Text>
          <Text style={styles.statusInfoSubtitleText}>
            Unfortunately, the organizer did not approve your request for this
            round.
          </Text>
        </View>
      ) : game.status === "PLAYERS_REQUIRED" &&
        game.players_current >= game.players_needed ? (
        <View style={styles.statusInfoSection}>
          <Ionicons
            name="sad-outline"
            size={24}
            color={colors.text.secondary}
            style={{ marginBottom: spacing.sm }}
          />
          <Text style={styles.statusInfoTitleText}>Round Full</Text>
          <Text style={styles.statusInfoSubtitleText}>
            This round has reached its maximum number of players.
          </Text>
        </View>
      ) : game.status === "READY_TO_BOOK" &&
        currentUserStatusInGame === null ? (
        <View style={styles.statusInfoSection}>
          <Ionicons
            name="time-outline"
            size={24}
            color={colors.text.secondary}
            style={{ marginBottom: spacing.sm }}
          />
          <Text style={styles.statusInfoTitleText}>Team Locked In</Text>
          <Text style={styles.statusInfoSubtitleText}>
            This round is full and awaiting booking by the organizer.
          </Text>
        </View>
      ) : (
        <View style={styles.waitingSection}>
          {game.status === "PLAYERS_REQUIRED" ? (
            <>
              <Text style={styles.waitingText}>
                {playersNeededToDisplay > 0
                  ? `Waiting for ${playersNeededToDisplay} more ${
                      playersNeededToDisplay === 1 ? "player" : "players"
                    }`
                  : "This round is ready for more players!"}
              </Text>
              {playersNeededToDisplay > 0 && canRequestToJoin && (
                <Text style={styles.subWaitingText}>
                  Request to join if you're interested!
                </Text>
              )}
            </>
          ) : (
            <Text style={styles.waitingText}>
              The round is currently being organized.
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  nonOrganizerContentContainer: {
    paddingHorizontal: spacing.sm,
    paddingVertical: Platform.OS === "ios" ? spacing.md : spacing.xs,
  },
  statusInfoSection: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Platform.OS === "ios" ? spacing.xl : spacing.md,
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
  nonOrganizerReadyContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: Platform.OS === "ios" ? spacing.md : spacing.xs,
    alignItems: "center",
  },
  teeTimeBookedMessageContainer: {
    alignItems: "center",
    marginVertical: spacing.xl,
  },
  teeTimeBookedTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.xl,
    fontFamily: typography.fontFamily.regular,
    textAlign: "center",
  },
  teeTimeBookedTime: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.xxxl,
    fontFamily: typography.fontFamily.semibold,
    textAlign: "center",
    marginTop: spacing.xs,
  },
  paymentStatusSection: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderRadius: spacing.md,
    marginBottom: spacing.lg,
  },
  paymentStatusTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.xl,
    fontFamily: typography.fontFamily.semibold,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  paymentStatusSubtitle: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
    textAlign: "center",
  },
});
