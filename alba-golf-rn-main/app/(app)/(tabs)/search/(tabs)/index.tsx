import Filters from "@/components/Filters";
import RoundCard from "@/components/ui/RoundCard";
import { SearchInput } from "@/components/ui/SearchInput";
import { AuthProvider, useAuth } from "@/providers/Auth";
import {
  Button,
  FlatList,
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { colors, spacing } from "@/constants/theme";
import { CircleButton } from "@/components/ui/CircleButton";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useProfileStore } from "@/stores/profileStore";
import { getSuggestedGames } from "@/api/games";
import { useEffect, useState, useCallback } from "react";
import { useLocation } from "@/providers/LocationProvider";
import { useGettingStartedChecklist } from "@/hooks/useGettingStartedChecklist";

interface GamePlayerUser {
  id: string;
  profile: { first_name?: string | null; photo?: string | null } | null;
  // Add other fields from UserWithProfile if needed by GameListing, e.g., onboarding
}

interface GamePlayer {
  user_id: string;
  user: GamePlayerUser;
  status: string; // IMPORTANT: We need status to filter approved players
}

interface Game {
  id: string;
  name?: string | null;
  courseName: string;
  courseId: string;
  date: string;
  gameType: string;
  gameFormat: string;
  playersNeeded: number; // Total slots
  players: GamePlayer[]; // Array of all players in the game
  creatorId: string; // ID of the game creator
  timeSlot: string;
  exact_time?: string | null;
  costPerPlayer?: number | null;
}

interface DateRange {
  startDate: Date;
  endDate: Date;
}

interface LocationFilter {
  name: string;
  latitude: number;
  longitude: number;
}

const SHOW_FILTERS = false;

export default function Page() {
  const { user, initializing: authInitializing } = useAuth();
  const { profile } = useProfileStore();
  const tabBarHeight = useBottomTabBarHeight();
  const { stripeActive } = useGettingStartedChecklist();

  const { currentLocation, isLoadingLocation, locationError } = useLocation();

  const [games, setGames] = useState<Game[]>([]);
  const [isLoadingGames, setIsLoadingGames] = useState(false);
  const [gamesError, setGamesError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Filter states
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange>(() => {
    const today = new Date();
    const thirtyDaysFromToday = new Date(today);
    thirtyDaysFromToday.setDate(today.getDate() + 30);
    return {
      startDate: today,
      endDate: thirtyDaysFromToday,
    };
  });
  const [distance, setDistance] = useState(1000);
  const [selectedLocation, setSelectedLocation] =
    useState<LocationFilter | null>(null);

  // Set default location when currentLocation is available
  useEffect(() => {
    if (currentLocation && !selectedLocation) {
      setSelectedLocation({
        name: "My Location",
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
      });
    }
  }, [currentLocation]);

  const fetchGames = async (
    searchRadius: number = distance,
    dateRange: DateRange = selectedDateRange,
    location: LocationFilter | null = selectedLocation
  ) => {
    if (!location || !user) {
      return;
    }

    setIsLoadingGames(true);
    setGamesError(null);
    try {
      // If using a custom location (not "My Location"), pass lat/lng parameters
      if (location.name === "Selected Area") {
        const fetchedGames = await getSuggestedGames(
          searchRadius,
          dateRange.startDate,
          dateRange.endDate,
          location.latitude,
          location.longitude
        );
        setGames(fetchedGames || []);
      } else {
        // Using current location, don't pass lat/lng parameters
        const fetchedGames = await getSuggestedGames(
          searchRadius,
          dateRange.startDate,
          dateRange.endDate
        );
        setGames(fetchedGames || []);
      }
    } catch (err: any) {
      console.error("Error fetching nearby games (from Provider):", err);
      setGamesError("Failed to fetch nearby games. " + (err.message || ""));
    } finally {
      setIsLoadingGames(false);
    }
  };

  // Fetch games when dependencies change
  useEffect(() => {
    fetchGames();
  }, [
    selectedLocation,
    user,
    isLoadingLocation,
    locationError,
    distance,
    selectedDateRange,
  ]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await fetchGames();
    setIsRefreshing(false);
  };

  const handleDateRangeChange = (dateRange: DateRange) => {
    setSelectedDateRange(dateRange);
  };

  const handleDistanceChange = (newDistance: number) => {
    setDistance(newDistance);
  };

  const handleLocationChange = (location: LocationFilter | null) => {
    setSelectedLocation(location);
  };

  if (
    authInitializing ||
    (user && isLoadingLocation && !currentLocation && !locationError)
  ) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="small" color={colors.text.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: "white" }}>Please login to continue</Text>
        <Button
          title="Login"
          onPress={() => {
            router.push("/welcome");
          }}
        />
      </View>
    );
  }

  if (user && locationError && !isLoadingLocation && !currentLocation) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <Text
          style={{
            color: colors.text.secondary,
            textAlign: "center",
            marginBottom: 20,
          }}
        >
          Please ensure location services are enabled and permissions are
          granted for the app.
        </Text>
      </View>
    );
  }

  const handleFabButtonPress = () => {
    if (stripeActive) {
      router.navigate("/create-round" as any);
    } else {
      router.navigate("/stripe-onboarding" as any);
    }
  };

  const normalizedTerm = searchTerm.trim().toLowerCase();
  const filteredGames =
    normalizedTerm.length === 0
      ? games
      : games.filter((g) => {
          const courseMatch = g.courseName?.toLowerCase().includes(normalizedTerm);
          const nameMatch = g.name?.toLowerCase().includes(normalizedTerm);
          return courseMatch || nameMatch;
        });

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <SearchInput
          placeholder="Search by course or game name"
          value={searchTerm}
          onChangeText={setSearchTerm}
          leftIcon="search"
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
      </View>
      {SHOW_FILTERS && (
        <Filters
          selectedDateRange={selectedDateRange}
          distance={distance}
          selectedLocation={selectedLocation}
          onDateRangeChange={handleDateRangeChange}
          onDistanceChange={handleDistanceChange}
          onLocationChange={handleLocationChange}
        />
      )}
      {/* Initial loading indicator: Show only when games array is empty, not refreshing, and loading */}
      {isLoadingGames && games.length === 0 && !isRefreshing && (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="small" color={colors.text.primary} />
          <Text style={{ color: colors.text.secondary, marginTop: 10 }}>
            Finding rounds...
          </Text>
        </View>
      )}

      {/* Waiting for location message */}
      {!isLoadingGames &&
        !gamesError &&
        games.length === 0 &&
        !isRefreshing &&
        !selectedLocation &&
        !locationError &&
        user && (
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              padding: 20,
            }}
          >
            <Text style={{ color: colors.text.secondary, textAlign: "center" }}>
              Waiting for location to find rounds...
            </Text>
          </View>
        )}

      {/* Error loading games message */}
      {!isLoadingGames && gamesError && !isRefreshing && (
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
        >
          <Text style={{ color: colors.text.primary, textAlign: "center" }}>
            Error loading rounds. Please try again later
          </Text>
        </View>
      )}

      {/* FlatList: Always show when there's no blocking error so that users can pull-to-refresh, even if the list is empty. */}
      {!(!isRefreshing && gamesError) &&
        (games.length > 0 ||
          isRefreshing ||
          (selectedLocation && !isLoadingGames && !gamesError)) && (
          <FlatList
            data={filteredGames}
            renderItem={({ item }) => (
              <RoundCard
                id={item.id}
                name={item.name}
                courseName={item.courseName}
                selectedDate={new Date(item.date).getTime()}
                exactTime={item.exact_time}
                timeSlot={item.timeSlot}
                playersNeeded={item.playersNeeded}
                playersInGame={item.players}
                costPerPlayer={item.costPerPlayer}
              />
            )}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{
              paddingHorizontal: 10,
              paddingBottom: 120,
              flexGrow: filteredGames.length === 0 ? 1 : undefined, // Center empty component if needed
            }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={() =>
              !isLoadingGames && // only when not loading
              !gamesError && // and there is no error
              selectedLocation ? (
                <View
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                    padding: 20,
                  }}
                >
                  <Text
                    style={{
                      color: colors.text.secondary,
                      textAlign: "center",
                    }}
                  >
                    {normalizedTerm.length > 0
                      ? "No rounds match your search."
                      : "No rounds found. Pull down to refresh."}
                  </Text>
                </View>
              ) : null
            }
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={onRefresh}
                tintColor={colors.text.primary}
                colors={[colors.text.primary]}
              />
            }
          />
        )}
      <View style={[styles.fabContainerBase, { bottom: tabBarHeight + 20 }]}>
        <CircleButton onPress={handleFabButtonPress} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.black,
  },
  searchContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  fabContainerBase: {
    position: "absolute",
    right: 20,
  },
});
