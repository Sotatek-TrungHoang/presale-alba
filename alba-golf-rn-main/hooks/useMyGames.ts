import { useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { getMyGames, GameType } from "@/api/games";
import { useAuth } from "@/hooks/useAuth";

interface DisplayGame {
  id: string | null;
  playersNeeded: number | null;
  timeSlot: string | null;
  gameType: string | null;
  gameFormat: string | null;
  courseName: string | null;
  courseId: string | null;
  selectedDate: number | null;
  reviewCard: boolean;
  playersInGame: Array<{
    user_id: string;
    user: {
      id: string;
      profile: {
        first_name?: string | null;
        photo?: string | null;
      } | null;
    };
    status: string;
  }>;
  creatorId: string;
  status: string;
}

export function useMyGames(gameType: GameType) {
  const [games, setGames] = useState<DisplayGame[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();

  const fetchGames = useCallback(
    async (isRefresh = false) => {
      if (!user) {
        if (!isRefresh) setIsLoading(false);
        setGames([]);
        return;
      }

      if (!isRefresh) setIsLoading(true);
      setError(null);

      try {
        const fetchedGames = await getMyGames(gameType);
        setGames(fetchedGames);
      } catch (err) {
        setError(`Failed to load ${gameType} games.`);
        console.error(err);
        setGames([]);
      } finally {
        if (!isRefresh) setIsLoading(false);
        if (isRefresh) setRefreshing(false);
      }
    },
    [user, gameType]
  );

  // Fetch games when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchGames();
    }, [fetchGames])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchGames(true);
  }, [fetchGames]);

  return {
    games,
    isLoading,
    error,
    refreshing,
    onRefresh,
    refetch: fetchGames,
  };
}
