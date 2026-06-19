import { useState, useEffect, useCallback } from "react";
import { Alert } from "react-native";
import { getGameById } from "@/api/games";
import { useProfileStore } from "@/stores/profileStore";

export interface GameDetail {
  id: string;
  creator_id: string;
  creator: {
    id: string;
    profile: {
      first_name?: string | null;
      last_name?: string | null;
      photo?: string | null;
    } | null;
  };
  name?: string | null;
  date: string;
  time_slot: string;
  players_current: number;
  players_needed: number;
  course_id?: string | null;
  course?: {
    id: string;
    name: string;
    booking_url?: string | null;
  } | null;
  game_type: string;
  game_format?: string | null;
  players: Array<{
    user_id: string;
    user: {
      id: string;
      profile: {
        first_name?: string | null;
        last_name?: string | null;
        photo?: string | null;
      } | null;
      onboarding: {
        handicap_range: string;
      } | null;
    };
    status: string;
    has_paid?: boolean;
    refunded?: boolean;
  }>;
  conversation: {
    id: string;
  } | null;
  status: string;
  exact_time?: string;
  cost_per_player?: number;
}

export const useGameDetail = (gameId: string) => {
  const [game, setGame] = useState<GameDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { profile } = useProfileStore();

  const fetchGameDetails = useCallback(
    async (isRefresh = false) => {
      if (!isRefresh && !isLoading) setIsLoading(true);
      if (isRefresh) setIsRefreshing(true);
      setError(null);

      try {
        console.log(`Fetching game details for ID: ${gameId}`);
        const fetchedGame = await getGameById(gameId);
        setGame(fetchedGame);
      } catch (err: any) {
        console.error("Failed to fetch game details:", err);
        setError("Failed to load game details. " + (err.message || ""));
      } finally {
        if (!isRefresh) setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [gameId, isLoading, profile]
  );

  useEffect(() => {
    if (!gameId) {
      setError("Game ID not found.");
      setIsLoading(false);
      return;
    }
    fetchGameDetails();
  }, [gameId, profile, fetchGameDetails]);

  const onRefresh = useCallback(() => {
    fetchGameDetails(true);
  }, [fetchGameDetails]);

  // Computed values
  const isOrganizer = profile?.id === game?.creator_id;
  const playersNeededToDisplay = Math.max(
    0,
    (game?.players_needed || 0) - (game?.players_current || 0)
  );
  const currentUserGamePlayerEntry = game?.players.find(
    (p) => p.user_id === profile?.id
  );
  const currentUserStatusInGame = currentUserGamePlayerEntry?.status || null;
  const currentUserHasPaid = currentUserGamePlayerEntry?.has_paid === true;
  const currentUserRefunded = currentUserGamePlayerEntry?.refunded === true;
  const approvedOrConfirmedPlayers =
    game?.players.filter(
      (p) => p.status === "APPROVED" || p.status === "CONFIRMED"
    ) || [];
  const pendingJoinRequests = isOrganizer
    ? game?.players.filter(
        (p) => p.status === "PENDING" && p.user_id !== profile?.id
      ) || []
    : [];

  const canRequestToJoin =
    !isOrganizer &&
    currentUserStatusInGame === null &&
    game?.status === "PLAYERS_REQUIRED" &&
    (game?.players_current || 0) < (game?.players_needed || 0);

  return {
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
    refetch: () => fetchGameDetails(true),
  };
};
