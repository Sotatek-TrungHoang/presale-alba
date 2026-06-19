import { useEffect, useState, useMemo } from "react";
import { useRouter } from "expo-router";
import { useProfileStore } from "@/stores/profileStore";
import { useAuth } from "@/hooks/useAuth";
import { getStripeOnboardingStatus } from "@/api/stripe";
import { getMyGames, UserGameHistory, getUserGameHistory } from "@/api/games";

export function useGettingStartedChecklist() {
  const { profile } = useProfileStore();
  const { user, initializing } = useAuth();
  const router = useRouter();

  const [stripe, setStripe] = useState<{
    loading: boolean;
    status: "active" | "pending_verification" | "not_started" | null;
    error: Error | null;
  }>({ loading: true, status: null, error: null });
  const [games, setGames] = useState<any[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [gamesError, setGamesError] = useState<Error | null>(null);
  const [userGameHistory, setUserGameHistory] =
    useState<UserGameHistory | null>(null);

  // Fetch Stripe status once auth settled and user exists
  useEffect(() => {
    let cancelled = false;
    if (!user) return;
    setStripe((s) => ({ ...s, loading: true, error: null }));
    (async () => {
      try {
        const data = await getStripeOnboardingStatus();
        if (!cancelled)
          setStripe({ loading: false, status: data.status, error: null });
      } catch (e: any) {
        if (!cancelled)
          setStripe({ loading: false, status: "not_started", error: e });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Fetch games created by user (any type)
  useEffect(() => {
    let cancelled = false;
    if (!user) return;
    setGamesLoading(true);
    setGamesError(null);
    (async () => {
      try {
        const data = await getMyGames("upcoming");
        if (!cancelled) setGames(data);
      } catch (e: any) {
        if (!cancelled) setGamesError(e);
      } finally {
        if (!cancelled) setGamesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    if (!user) return;

    const fetchUserGameHistory = async () => {
      try {
        const data = await getUserGameHistory();
        if (!cancelled) setUserGameHistory(data);
      } catch (e: any) {
        if (!cancelled) setGamesError(e);
      } finally {
        if (!cancelled) setGamesLoading(false);
      }
    };
    fetchUserGameHistory();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const tasks = useMemo(() => {
    if (!user) return [];
    const photoComplete = Boolean(profile?.profile?.photo);
    const stripeActive = stripe.status === "active";
    const joinedGame = userGameHistory?.hasJoinedGames ?? false;
    const createdGame = userGameHistory?.hasCreatedGames ?? false;

    return [
      {
        id: "onboarding",
        title: "Complete your onboarding",
        complete: true,
        unlocked: true,
        action: () => {},
      },
      {
        id: "photo",
        title: "Add a profile photo",
        complete: photoComplete,
        unlocked: true,
        action: () => router.push("/edit-profile"),
      },
      {
        id: "join",
        title: "Join a round",
        complete: joinedGame,
        unlocked: true,
        action: () => router.push("/search"),
      },
      {
        id: "host",
        title: "Organise your first round",
        complete: createdGame,
        unlocked: true,
        action: () => router.push(stripeActive ? "/create-round" : "/stripe-onboarding"),
      },
    ];
  }, [
    profile,
    stripe.status,
    stripe.loading,
    userGameHistory,
    user?.uid,
    router,
    user,
  ]);

  const visibleTasks = tasks.filter((t) => !t.complete);
  const completedCount = tasks.filter((t) => t.complete).length;
  const unlockedCount = tasks.filter((t) => t.unlocked).length;

  // Auth loading: don't render anything
  if (initializing || !user) {
    return {
      loading: true,
      dataReady: false,
      hasError: false,
      error: null,
      tasks: [],
      visibleTasks: [],
      completedCount: 0,
      unlockedCount: 0,
      stripeActive: false,
    };
  }

  // Data loading
  const dataReady = !stripe.loading && !gamesLoading;
  const hasError = Boolean(stripe.error || gamesError);
  const error = stripe.error || gamesError;

  // Single source of truth for stripeActive - calculate once and use consistently
  const stripeActive = stripe.status === "active";

  return {
    loading: false,
    dataReady,
    hasError,
    error,
    tasks,
    visibleTasks,
    completedCount,
    unlockedCount,
    stripeActive,
  };
}
