import { useState } from "react";
import { Alert } from "react-native";
import * as WebBrowser from "expo-web-browser";
import {
  updatePlayerStatusInGame,
  UpdatePlayerStatusDto,
  requestToJoinGame,
  confirmBookingDetails,
  ConfirmBookingDetailsDto,
  completeGame,
} from "@/api/games";
import { GameDetail } from "./useGameDetail";

export const useGameActions = (
  game: GameDetail | null,
  refetch: () => void
) => {
  const [isSubmittingPlayerStatus, setIsSubmittingPlayerStatus] =
    useState(false);
  const [isRequestingToJoin, setIsRequestingToJoin] = useState(false);
  const [isConfirmingBookingDetails, setIsConfirmingBookingDetails] =
    useState(false);
  const [isCompletingGame, setIsCompletingGame] = useState(false);

  const handlePlayerStatusUpdate = async (
    playerId: string,
    status: "APPROVED" | "REJECTED"
  ) => {
    if (!game) return;
    setIsSubmittingPlayerStatus(true);
    try {
      const dto: UpdatePlayerStatusDto = { status };
      await updatePlayerStatusInGame(game.id, playerId, dto);
      Alert.alert(
        "Success",
        `Player request has been ${status.toLowerCase()}.`
      );
      refetch();
    } catch (apiError: any) {
      console.error("Error updating player status:", apiError);
      Alert.alert(
        "Error",
        apiError.message || "Could not update player status."
      );
    } finally {
      setIsSubmittingPlayerStatus(false);
    }
  };

  const handleRequestToJoin = async () => {
    if (!game) {
      Alert.alert("Error", "Game details not available.");
      return;
    }
    setIsRequestingToJoin(true);
    try {
      await requestToJoinGame(game.id);
      Alert.alert(
        "Request Sent!",
        "Your request to join has been sent to the organizer."
      );
      refetch();
    } catch (apiError: any) {
      console.error("Error requesting to join game:", apiError);
      const errorMessage =
        apiError.response?.data?.message ||
        apiError.message ||
        "Could not send join request.";
      Alert.alert("Error", errorMessage);
    } finally {
      setIsRequestingToJoin(false);
    }
  };

  const handleBookTeeTime = async () => {
    const courseUrl = game?.course?.booking_url;
    if (courseUrl) {
      try {
        await WebBrowser.openBrowserAsync(courseUrl);
        return true; // Indicate success
      } catch (err) {
        Alert.alert("Error", "Could not open the course booking link.");
        console.error("Failed to open URL with WebBrowser:", err);
        return false;
      }
    } else {
      Alert.alert("Not Available", "Course booking link is not available.");
      return false;
    }
  };

  const handleConfirmBookingOnServer = async (
    exactTime: string,
    totalCost: number
  ) => {
    if (!game) return false;
    setIsConfirmingBookingDetails(true);

    try {
      const dto: ConfirmBookingDetailsDto = {
        exact_time: exactTime,
        total_cost: totalCost,
      };
      await confirmBookingDetails(game.id, dto);
      Alert.alert("Success!", "Tee time and cost confirmed.");
      refetch();
      return true;
    } catch (apiError: any) {
      console.error("Error confirming booking details:", apiError);

      // Handle 409 as "already confirmed" - treat as success
      if (apiError.response?.status === 409) {
        Alert.alert(
          "Already Confirmed",
          "This booking has already been confirmed."
        );
        refetch();
        return true;
      }

      Alert.alert(
        "Error",
        apiError.message || "Could not confirm booking details."
      );
      return false;
    } finally {
      setIsConfirmingBookingDetails(false);
    }
  };

  const handleCompleteGame = async () => {
    if (!game) return;
    setIsCompletingGame(true);
    try {
      await completeGame(game.id);
      Alert.alert("Success", "Round marked as completed!");
      refetch();
    } catch (apiError: any) {
      console.error("Error completing round:", apiError);
      Alert.alert("Error", apiError.message || "Could not complete round.");
    } finally {
      setIsCompletingGame(false);
    }
  };

  return {
    isSubmittingPlayerStatus,
    isRequestingToJoin,
    isConfirmingBookingDetails,
    isCompletingGame,
    handlePlayerStatusUpdate,
    handleRequestToJoin,
    handleBookTeeTime,
    handleConfirmBookingOnServer,
    handleCompleteGame,
  };
};
