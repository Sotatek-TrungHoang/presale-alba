import React, { useState, useLayoutEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Alert,
  Pressable,
  Share,
} from "react-native";
import {
  useLocalSearchParams,
  Stack,
  router,
  useNavigation,
} from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "@/constants/theme";
import { GameHeader } from "@/components/ui/GameHeader";
import { PaymentSheetModal } from "@/components/modals/PaymentSheetModal";
import { EditGameModal } from "@/components/ui/EditGameModal";
import { BookingConfirmationModal } from "@/components/modals/BookingConfirmationModal";
import { ComplaintBanner } from "@/components/ui/ComplaintBanner";
import { OrganizerView } from "@/components/game/OrganizerView";
import { PlayerView } from "@/components/game/PlayerView";
import { GameBottomActions } from "@/components/game/GameBottomActions";
import { useGameDetail } from "@/hooks/useGameDetail";
import { useGameActions } from "@/hooks/useGameActions";
import { useComplaints } from "@/hooks/useComplaints";
import { useFocusEffect } from "@react-navigation/native";
import { logEvent } from "@/utils/analytics";

export default function GameDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const [hasAttemptedBooking, setHasAttemptedBooking] = useState(false);
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBookingConfirmationModal, setShowBookingConfirmationModal] =
    useState(false);

  // Custom hooks for data and actions
  const {
    game,
    isLoading,
    isRefreshing,
    error,
    isOrganizer,
    playersNeededToDisplay,
    currentUserStatusInGame,
    currentUserHasPaid,
    currentUserRefunded,
    approvedOrConfirmedPlayers,
    pendingJoinRequests,
    canRequestToJoin,
    onRefresh,
    refetch,
  } = useGameDetail(id as string);

  const {
    isRequestingToJoin,
    isConfirmingBookingDetails,
    isCompletingGame,
    handlePlayerStatusUpdate,
    handleRequestToJoin,
    handleBookTeeTime,
    handleConfirmBookingOnServer,
    handleCompleteGame,
  } = useGameActions(game, refetch);

  const { currentUserComplaint, refetch: refetchComplaints } = useComplaints(
    id as string
  );

  // Add useFocusEffect to refetch complaints when page is focused
  useFocusEffect(
    React.useCallback(() => {
      refetchComplaints();
    }, [refetchComplaints])
  );

  // Handler functions
  const handleViewProfile = (playerId: string) => {
    router.push(`/(app)/user/${playerId}` as any);
  };

  const handleOpenConfirmBookingModal = () => {
    setShowBookingConfirmationModal(true);
  };

  const handleResetBookingAttempt = () => {
    setHasAttemptedBooking(false);
  };

  const handleBookTeeTimePress = async () => {
    const success = await handleBookTeeTime();
    if (success) {
      setHasAttemptedBooking(true);
    }
  };

  const handleConfirmBooking = async (exactTime: string, totalCost: number) => {
    const success = await handleConfirmBookingOnServer(exactTime, totalCost);
    if (success) {
      setShowBookingConfirmationModal(false);
      setHasAttemptedBooking(false);
    }
    return success;
  };

  const handleEditPress = () => {
    if (
      game?.status !== "PLAYERS_REQUIRED" &&
      game?.status !== "READY_TO_BOOK"
    ) {
      Alert.alert(
        "Cannot Edit Round",
        "This round cannot be edited as it has already been finalized or completed."
      );
      return;
    }
    setShowEditModal(true);
  };

  const handleGameUpdated = () => {
    refetch();
  };

  // Complaint eligibility logic
  const canShowComplaintMenu = React.useMemo(() => {
    if (!game || isOrganizer) return false;

    // Only show for approved/confirmed players
    if (
      currentUserStatusInGame !== "APPROVED" &&
      currentUserStatusInGame !== "CONFIRMED"
    ) {
      return false;
    }

    // Only show for games in certain states
    if (
      game.status !== "READY" &&
      game.status !== "COMPLETED" &&
      game.status !== "CANCELLED"
    ) {
      return false;
    }

    // Check if user has already submitted a complaint
    if (currentUserComplaint) {
      return false;
    }

    // Check time window (48 hours after scheduled tee time)
    const gameDate = new Date(game.date);
    const now = new Date();
    const hoursSinceGame =
      (now.getTime() - gameDate.getTime()) / (1000 * 60 * 60);

    return hoursSinceGame <= 48;
  }, [game, isOrganizer, currentUserStatusInGame, currentUserComplaint]);

  // Determine if we are at least one calendar day beyond the scheduled game date
  const isGameDateInPast = React.useMemo(() => {
    if (!game?.date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const gameDate = new Date(game.date);
    gameDate.setHours(0, 0, 0, 0);
    return today.getTime() > gameDate.getTime();
  }, [game?.date]);

  const handleShare = async () => {
    if (!game) return;
    const url = `https://app.golfalba.co/round/${game.id}`;
    const courseName = game.course?.name ?? "a round";
    const message = `Join me for ${courseName} on ${displayDate} — ${url}`;
    try {
      const result = await Share.share({ message, url });
      // Only report to Meta when the round was actually shared, not dismissed.
      if (result.action === Share.sharedAction) {
        logEvent("fb_mobile_share", {
          content_type: "round",
          content_id: game.id,
        });
      }
    } catch (err) {
      console.warn("Share failed", err);
    }
  };

  const handleHeaderMenuPress = () => {
    Alert.alert("Round Options", "What would you like to do?", [
      {
        text: "Report an Issue",
        onPress: () => router.push(`/(app)/round/${id}/report-issue` as any),
      },
      {
        text: "Cancel",
        style: "cancel",
      },
    ]);
  };

  // Set up header menu
  useLayoutEffect(() => {
    const showShare = !isOrganizer;
    const showMenu = canShowComplaintMenu;

    navigation.setOptions({
      headerRight:
        showShare || showMenu
          ? () => (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  height: "100%",
                }}
              >
                {showShare && (
                  <Pressable
                    onPress={handleShare}
                    style={({ pressed }) => [
                      styles.headerSharePill,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Ionicons
                      name="share-outline"
                      size={16}
                      color={colors.text.primary}
                    />
                    <Text style={styles.headerSharePillText}>Share</Text>
                  </Pressable>
                )}
                {showMenu && (
                  <Pressable
                    onPress={handleHeaderMenuPress}
                    style={{ padding: 8 }}
                  >
                    <Ionicons
                      name="ellipsis-horizontal"
                      size={24}
                      color={colors.text.primary}
                    />
                  </Pressable>
                )}
              </View>
            )
          : undefined,
    });
  }, [navigation, canShowComplaintMenu, game?.id, isOrganizer]);

  const handleRefresh = React.useCallback(() => {
    onRefresh();
    refetchComplaints();
  }, [onRefresh, refetchComplaints]);

  // Loading state
  if (isLoading && !isRefreshing && !game) {
    return (
      <SafeAreaView style={styles.centeredContainer}>
        <ActivityIndicator size="small" color={colors.text.primary} />
      </SafeAreaView>
    );
  }

  // Error state
  if (error && !game) {
    return (
      <SafeAreaView style={styles.centeredContainer}>
        <Stack.Screen options={{ title: "Error" }} />
        <Text style={styles.errorText}>{error}</Text>
      </SafeAreaView>
    );
  }

  // No game state
  if (!game) {
    return (
      <SafeAreaView style={styles.centeredContainer}>
        <Stack.Screen options={{ title: "Round Not Found" }} />
        <Text style={styles.errorText}>Round data is unavailable.</Text>
      </SafeAreaView>
    );
  }

  const displayDate = game.date
    ? new Date(game.date).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : "Date not set";

  // Calculate scroll view padding based on bottom actions
  const requestButtonVisible = !isOrganizer && canRequestToJoin;
  const showOrganizerBookTeeTimeLayout =
    isOrganizer &&
    game.status === "READY_TO_BOOK" &&
    !hasAttemptedBooking &&
    !isGameDateInPast;
  const showNonOrganizerPaymentUI =
    !isOrganizer && game.status === "READY" && !currentUserHasPaid;

  const scrollViewPaddingBottom =
    requestButtonVisible ||
    showOrganizerBookTeeTimeLayout ||
    showNonOrganizerPaymentUI
      ? spacing.xxl * 2.5
      : spacing.xxl;

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: scrollViewPaddingBottom }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.text.primary}
            colors={[colors.text.primary]}
          />
        }
      >
        <GameHeader
          courseName={game.course?.name ?? "Course not set"}
          name={game.name}
          date={displayDate}
          gameFormat={game.game_format ?? "N/A"}
          gameType={game.game_type}
          playersFromGame={game.players}
          creatorId={game.creator_id}
          totalPlayersNeeded={game.players_needed}
          timeSlot={game.time_slot}
          isCurrentUserOrganizer={isOrganizer}
          onEditPress={handleEditPress}
          gameStatus={game.status}
          exact_time={game.exact_time}
        />

        {/* Complaint Banner */}
        {currentUserComplaint && (
          <ComplaintBanner
            status={currentUserComplaint.status}
            description={currentUserComplaint.description}
            resolution={currentUserComplaint.resolution}
          />
        )}

        {isOrganizer ? (
          <OrganizerView
            game={game}
            pendingJoinRequests={pendingJoinRequests}
            approvedOrConfirmedPlayers={approvedOrConfirmedPlayers}
            playersNeededToDisplay={playersNeededToDisplay}
            hasAttemptedBooking={hasAttemptedBooking}
            onPlayerStatusUpdate={handlePlayerStatusUpdate}
            onViewProfile={handleViewProfile}
            onOpenConfirmBookingModal={handleOpenConfirmBookingModal}
            onResetBookingAttempt={handleResetBookingAttempt}
            onShare={handleShare}
          />
        ) : (
          <PlayerView
            game={game}
            currentUserStatusInGame={currentUserStatusInGame}
            playersNeededToDisplay={playersNeededToDisplay}
            canRequestToJoin={canRequestToJoin}
            currentUserHasPaid={currentUserHasPaid}
            currentUserComplaint={!!currentUserComplaint}
            currentUserRefunded={currentUserRefunded}
          />
        )}
      </ScrollView>

      <GameBottomActions
        game={game}
        isOrganizer={isOrganizer}
        currentUserStatusInGame={currentUserStatusInGame}
        approvedOrConfirmedPlayers={approvedOrConfirmedPlayers}
        canRequestToJoin={canRequestToJoin}
        hasAttemptedBooking={hasAttemptedBooking}
        onRequestToJoin={handleRequestToJoin}
        onBookTeeTime={handleBookTeeTimePress}
        onOpenPaymentSheet={() => setShowPaymentSheet(true)}
        isRequestingToJoin={isRequestingToJoin}
        currentUserHasPaid={currentUserHasPaid}
        currentUserRefunded={currentUserRefunded}
        isCompletingGame={isCompletingGame}
        onCompleteGame={handleCompleteGame}
      />

      {/* Modals */}
      <BookingConfirmationModal
        isVisible={showBookingConfirmationModal}
        onClose={() => setShowBookingConfirmationModal(false)}
        onConfirm={handleConfirmBooking}
        isLoading={isConfirmingBookingDetails}
      />

      <PaymentSheetModal
        isVisible={showPaymentSheet}
        onClose={() => setShowPaymentSheet(false)}
        courseName={game.course?.name}
        gameDate={displayDate}
        exactTime={game.exact_time}
        gameId={game.id}
        onPaymentSuccess={refetch}
      />

      {showEditModal && game && (
        <EditGameModal
          isVisible={showEditModal}
          onClose={() => setShowEditModal(false)}
          gameId={game.id}
          currentData={{
            course: game.course,
            name: game.name,
            date: game.date,
            time_slot: game.time_slot,
            players_needed: game.players_needed,
            game_type: game.game_type,
            game_format: game.game_format,
            status: game.status,
          }}
          onGameUpdated={handleGameUpdated}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.black,
  },
  scrollView: {
    flex: 1,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.neutral.black,
  },
  errorText: {
    color: colors.primary.red,
    fontSize: 16,
    textAlign: "center",
  },
  headerSharePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  headerSharePillText: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamily.semibold,
  },
});
