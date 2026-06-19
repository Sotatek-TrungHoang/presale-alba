import React from "react";
import { View, StyleSheet, Platform } from "react-native";
import { router } from "expo-router";
import { colors, spacing } from "@/constants/theme";
import { GameDetail } from "@/hooks/useGameDetail";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { CircleButton } from "@/components/ui/CircleButton";

interface GameBottomActionsProps {
  game: GameDetail;
  isOrganizer: boolean;
  currentUserStatusInGame: string | null;
  approvedOrConfirmedPlayers: GameDetail["players"];
  canRequestToJoin: boolean;
  hasAttemptedBooking: boolean;
  onRequestToJoin: () => void;
  onBookTeeTime: () => void;
  onOpenPaymentSheet: () => void;
  isRequestingToJoin?: boolean;
  currentUserHasPaid?: boolean;
  currentUserRefunded?: boolean;
  isCompletingGame?: boolean;
  onCompleteGame?: () => void;
}

export const GameBottomActions: React.FC<GameBottomActionsProps> = ({
  game,
  isOrganizer,
  currentUserStatusInGame,
  approvedOrConfirmedPlayers,
  canRequestToJoin,
  hasAttemptedBooking,
  onRequestToJoin,
  onBookTeeTime,
  onOpenPaymentSheet,
  isRequestingToJoin = false,
  currentUserHasPaid = false,
  currentUserRefunded = false,
  isCompletingGame = false,
  onCompleteGame,
}) => {
  // Handle null/undefined game
  if (!game) {
    return null;
  }

  const handleChatFabPress = () => {
    if (game?.conversation?.id) {
      router.push(`/(app)/chat/${game.conversation.id}` as any);
    }
  };

  // Calculate if complete game button should be shown
  const canShowCompleteButton = React.useMemo(() => {
    if (
      !game ||
      !isOrganizer ||
      game.status !== "READY" ||
      !game.exact_time ||
      !game.date
    ) {
      return false;
    }

    // Parse the date from the ISO string and extract just the date part
    const gameDate = new Date(game.date);
    const dateString = gameDate.toISOString().split("T")[0]; // Get YYYY-MM-DD

    // Combine date with exact_time
    const gameDateTime = new Date(`${dateString}T${game.exact_time}`);
    const now = new Date();
    const hoursSinceTeeTime =
      (now.getTime() - gameDateTime.getTime()) / (1000 * 60 * 60);

    return hoursSinceTeeTime >= 2;
  }, [game?.id, game?.status, game?.exact_time, game?.date, isOrganizer]);

  // Determine if we are now at least one calendar day beyond the scheduled game date
  const isGameDateInPast = React.useMemo(() => {
    if (!game?.date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0); // start of today (local)

    const gameDate = new Date(game.date);
    gameDate.setHours(0, 0, 0, 0); // start of game day

    return today.getTime() > gameDate.getTime();
  }, [game?.date]);

  // Request to join button
  if (canRequestToJoin) {
    return (
      <View style={styles.requestButtonContainer}>
        <SubmitButton
          title="Ask to Join"
          onPress={onRequestToJoin}
          isLoading={isRequestingToJoin}
          testID="submit-button"
        />
      </View>
    );
  }

  // Complete game button for organizer in READY state after 2 hours
  if (canShowCompleteButton) {
    return (
      <View style={styles.organizerBottomButtonContainer}>
        <View style={styles.completeGameButtonWrapper}>
          <SubmitButton
            title="Complete Round"
            onPress={onCompleteGame}
            isLoading={isCompletingGame}
            testID="complete-game-button"
          />
        </View>
        {game.conversation?.id && (
          <View style={styles.chatButtonInBarWrapper}>
            <CircleButton
              onPress={handleChatFabPress}
              iconFamily="Ionicons"
              iconName="chatbubble-outline"
              size={24}
              width={68}
              height={68}
              testID="circle-button"
            />
          </View>
        )}
      </View>
    );
  }

  // Organizer book tee time layout
  const showOrganizerBookTeeTimeLayout =
    isOrganizer &&
    game.status === "READY_TO_BOOK" &&
    !hasAttemptedBooking &&
    !isGameDateInPast;

  if (showOrganizerBookTeeTimeLayout) {
    return (
      <View style={styles.organizerBottomButtonContainer}>
        <View style={styles.bookTeeTimeButtonWrapper}>
          <SubmitButton
            title="Book Tee Time"
            onPress={onBookTeeTime}
            testID="submit-button"
          />
        </View>
        {game.conversation?.id && (
          <View style={styles.chatButtonInBarWrapper}>
            <CircleButton
              onPress={handleChatFabPress}
              iconFamily="Ionicons"
              iconName="chatbubble-outline"
              size={24}
              width={68}
              height={68}
              testID="circle-button"
            />
          </View>
        )}
      </View>
    );
  }

  // Non-organizer payment bar for READY games
  const showNonOrganizerPaymentUI =
    !isOrganizer &&
    game.status === "READY" &&
    (currentUserStatusInGame === "APPROVED" ||
      currentUserStatusInGame === "CONFIRMED") &&
    !currentUserHasPaid &&
    !currentUserRefunded;

  if (showNonOrganizerPaymentUI) {
    return (
      <View style={styles.nonOrganizerPaymentBar}>
        <View style={styles.makePaymentButtonWrapper}>
          <SubmitButton
            title="Make Payment"
            onPress={onOpenPaymentSheet}
            testID="submit-button"
          />
        </View>
        {game.conversation?.id && (
          <View style={styles.chatButtonInBarWrapper}>
            <CircleButton
              onPress={handleChatFabPress}
              iconFamily="Ionicons"
              iconName="chatbubble-outline"
              size={24}
              width={68}
              height={68}
              testID="circle-button"
            />
          </View>
        )}
      </View>
    );
  }

  // Floating chat button for other cases
  const canShowChatFab =
    (game.status === "READY_TO_BOOK" || game.status === "READY") &&
    (currentUserStatusInGame === "APPROVED" ||
      currentUserStatusInGame === "CONFIRMED") &&
    approvedOrConfirmedPlayers.length > 1 &&
    game.conversation?.id;

  if (canShowChatFab) {
    return (
      <View style={styles.chatFabContainer}>
        <CircleButton
          onPress={handleChatFabPress}
          iconFamily="Ionicons"
          iconName="chatbubble-outline"
          testID="circle-button"
        />
      </View>
    );
  }

  // Chat FAB for non-organizer who has paid in READY state
  if (
    !isOrganizer &&
    game.status === "READY" &&
    currentUserHasPaid &&
    game?.conversation?.id &&
    approvedOrConfirmedPlayers.length > 1
  ) {
    return (
      <View style={styles.chatFabContainer}>
        <CircleButton
          onPress={handleChatFabPress}
          iconFamily="Ionicons"
          iconName="chatbubble-outline"
          testID="circle-button"
        />
      </View>
    );
  }

  // Chat FAB for organizer in READY or READY_TO_BOOK state (when bottom bar is not shown)
  if (
    isOrganizer &&
    (game.status === "READY" || game.status === "READY_TO_BOOK") &&
    game?.conversation?.id &&
    approvedOrConfirmedPlayers.length > 1 &&
    !showOrganizerBookTeeTimeLayout
  ) {
    return (
      <View style={styles.chatFabContainer}>
        <CircleButton
          onPress={handleChatFabPress}
          iconFamily="Ionicons"
          iconName="chatbubble-outline"
          testID="circle-button"
        />
      </View>
    );
  }

  // Chat FAB for completed games
  if (
    game.status === "COMPLETED" &&
    game?.conversation?.id &&
    approvedOrConfirmedPlayers.length > 1
  ) {
    return (
      <View style={styles.chatFabContainer}>
        <CircleButton
          onPress={handleChatFabPress}
          iconFamily="Ionicons"
          iconName="chatbubble-outline"
          testID="circle-button"
        />
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  requestButtonContainer: {
    padding: spacing.lg,
    backgroundColor: colors.neutral.black,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.surface,
  },
  organizerBottomButtonContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    backgroundColor: colors.neutral.black,
  },
  bookTeeTimeButtonWrapper: {
    flex: 1,
    marginRight: spacing.md,
  },
  chatButtonInBarWrapper: {},
  nonOrganizerPaymentBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    backgroundColor: colors.neutral.black,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.surface,
  },
  makePaymentButtonWrapper: {
    flex: 1,
    marginRight: spacing.md,
  },
  chatFabContainer: {
    position: "absolute",
    right: spacing.lg,
    bottom: Platform.OS === "ios" ? spacing.xxl * 2 : spacing.sm,
  },
  completeGameButtonWrapper: {
    flex: 1,
    marginRight: spacing.md,
  },
});
