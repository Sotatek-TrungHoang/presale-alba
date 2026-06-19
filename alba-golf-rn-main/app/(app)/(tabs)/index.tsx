import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";

import { useProfileStore } from "@/stores/profileStore";
import { colors, spacing, typography } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "@/providers/LocationProvider";
import { getNearbyGames } from "@/api/games";
import { Heading } from "@/components/ui/Heading";
import NearbyGameCard from "@/components/home/NearbyGameCard";
import NoGamesNearbyState from "@/components/home/NoGamesNearbyState";
import PaymentRequirementsBanner from "@/components/home/PaymentRequirementsBanner";
import { useGettingStartedChecklist } from "@/hooks/useGettingStartedChecklist";

const DEFAULT_RADIUS_MILES = 50;

interface NearbyGame {
  id: string;
  name?: string | null;
  courseName: string;
  courseId: string;
  date: string;
  gameType: string;
  gameFormat: string;
  playersNeeded: number;
  players: Array<{
    user_id: string;
    user: {
      id: string;
      profile: { first_name?: string | null; photo?: string | null } | null;
    };
    status: string;
    created_at?: string | null;
  }>;
  creatorId: string;
  timeSlot: string;
  status: string;
  exact_time?: string | null;
  costPerPlayer?: number | null;
  totalCost?: number | null;
  latestPlayerCreatedAt?: string | null;
}

export default function HomeScreen() {
  const { user, initializing } = useAuth();
  const { profile, fetchProfile } = useProfileStore();
  const { currentLocation, isLoadingLocation, locationError } = useLocation();
  const tabBarHeight = useBottomTabBarHeight();
  const router = useRouter();
  const { stripeActive } = useGettingStartedChecklist();

  const handleStartRound = () => {
    if (stripeActive) {
      router.navigate("/create-round" as any);
    } else {
      router.navigate("/stripe-onboarding" as any);
    }
  };

  const handleSearchWider = () => {
    router.navigate("/(app)/(tabs)/search" as any);
  };

  const [games, setGames] = useState<NearbyGame[]>([]);
  const [isLoadingGames, setIsLoadingGames] = useState(false);
  const [gamesError, setGamesError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchGames = useCallback(async () => {
    if (!user || !currentLocation) return;
    setIsLoadingGames(true);
    setGamesError(null);
    try {
      const fetched = await getNearbyGames(
        currentLocation.latitude,
        currentLocation.longitude,
        DEFAULT_RADIUS_MILES
      );
      setGames(fetched || []);
    } catch (err: any) {
      console.error("Error fetching nearby games:", err);
      setGamesError("Couldn't load nearby games. Pull to retry.");
    } finally {
      setIsLoadingGames(false);
    }
  }, [user, currentLocation]);

  useFocusEffect(
    useCallback(() => {
      if (user && !initializing) {
        fetchProfile();
      }
    }, [user, initializing, fetchProfile])
  );

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await fetchGames();
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchGames]);

  if (initializing || !profile) {
    return (
      <ActivityIndicator color={colors.text.primary} style={{ flex: 1 }} />
    );
  }

  const firstName = profile?.profile?.first_name ?? "Golfer";

  const showInitialLoading =
    (isLoadingLocation && !currentLocation && !locationError) ||
    (isLoadingGames && games.length === 0 && !isRefreshing);

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: tabBarHeight + spacing.md },
      ]}
      bounces
      alwaysBounceVertical
      overScrollMode="always"
      refreshing={isRefreshing}
      onRefresh={onRefresh}
      data={games}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <NearbyGameCard
          id={item.id}
          name={item.name}
          courseName={item.courseName}
          selectedDate={item.date ? new Date(item.date).getTime() : null}
          exactTime={item.exact_time}
          timeSlot={item.timeSlot}
          playersNeeded={item.playersNeeded}
          playersInGame={item.players}
          costPerPlayer={item.costPerPlayer}
          latestPlayerCreatedAt={item.latestPlayerCreatedAt}
        />
      )}
      ListHeaderComponent={
        <View>
          <PaymentRequirementsBanner />
          <View style={styles.greetingRow}>
            <Heading level={2} weight="light">
              Welcome, {firstName}!
            </Heading>
          </View>
          {games.length > 0 && (
            <Text style={styles.sectionTitle}>Near you right now</Text>
          )}
        </View>
      }
      ListEmptyComponent={
        showInitialLoading ? (
          <View style={styles.stateContainer}>
            <ActivityIndicator color={colors.text.primary} size="small" />
          </View>
        ) : gamesError ? (
          <View style={styles.stateContainer}>
            <Text style={styles.stateText}>{gamesError}</Text>
          </View>
        ) : locationError && !currentLocation ? (
          <View style={styles.stateContainer}>
            <Text style={styles.stateText}>
              Enable location to find games nearby.
            </Text>
          </View>
        ) : (
          <NoGamesNearbyState
            onStartRound={handleStartRound}
            onSearchWider={handleSearchWider}
          />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.black,
  },
  content: {
    padding: spacing.md,
    flexGrow: 1,
  },
  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.lg,
    fontFamily: typography.fontFamily.medium,
    marginBottom: spacing.sm,
  },
  stateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: spacing.xl,
    minHeight: 200,
  },
  stateText: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
    textAlign: "center",
  },
});
