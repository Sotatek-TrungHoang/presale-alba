import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/providers/Auth";
import { useLocation } from "@/providers/LocationProvider";
import { searchGolfers, SearchUsersApiDto } from "@/api/user";
import GolferCard, { GolferUser } from "@/components/ui/GolferCard";
import { colors, spacing, typography } from "@/constants/theme";
import { LocationFilterModal } from "@/components/modals/LocationFilterModal";
import { DistanceModal } from "@/components/modals/DistanceModal";
import {
  PlayerPreferencesModal,
  PlayerPreferenceFilters,
} from "@/components/modals/PlayerPreferencesModal";
import { useDebounce } from "@/hooks/useDebounce";

interface LocationFilter {
  name: string;
  latitude: number;
  longitude: number;
}

const PAGE_LIMIT = 50; // Can still be used if backend uses 'limit', otherwise can be removed or ignored

export default function GolfersPage() {
  const { user } = useAuth();
  const { currentLocation } = useLocation();
  const [golfers, setGolfers] = useState<GolferUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLocation, setSelectedLocation] =
    useState<LocationFilter | null>(null);
  const [distance, setDistance] = useState(50);
  const [isLocationModalVisible, setIsLocationModalVisible] = useState(false);
  const [isDistanceModalVisible, setIsDistanceModalVisible] = useState(false);
  const [isPreferencesModalVisible, setIsPreferencesModalVisible] =
    useState(false);
  const [playerPreferenceFilters, setPlayerPreferenceFilters] =
    useState<PlayerPreferenceFilters>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  useEffect(() => {
    if (currentLocation && !selectedLocation) {
      setSelectedLocation({
        name: "My Location",
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
      });
    }
  }, [currentLocation]);

  const handleLocationSelect = (location: LocationFilter) => {
    setSelectedLocation(location);
  };

  const handleClearLocation = () => {
    if (currentLocation) {
      setSelectedLocation({
        name: "My Location",
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
      });
    } else {
      setSelectedLocation(null);
    }
  };

  const handleDistanceChange = (newDistance: number) => {
    setDistance(newDistance);
  };

  const handleApplyPlayerPreferences = (filters: PlayerPreferenceFilters) => {
    setPlayerPreferenceFilters(filters);
  };

  const fetchAndSetGolfers = useCallback(async () => {
    if (!user) {
      setGolfers([]);
      return;
    }
    if (currentLocation && !selectedLocation) {
      return;
    }

    if (!isRefreshing) setIsLoading(true);
    setError(null);

    try {
      const apiParams: SearchUsersApiDto = {
        limit: PAGE_LIMIT,
      };

      if (debouncedSearchTerm.trim()) {
        apiParams.searchTerm = debouncedSearchTerm.trim();
      }
      if (selectedLocation) {
        apiParams.lat = selectedLocation.latitude;
        apiParams.lng = selectedLocation.longitude;
        apiParams.distance = distance;
      }
      if (
        playerPreferenceFilters.handicapRanges &&
        playerPreferenceFilters.handicapRanges.length > 0
      ) {
        apiParams.handicapRanges = playerPreferenceFilters.handicapRanges;
      }
      if (
        playerPreferenceFilters.playerTypes &&
        playerPreferenceFilters.playerTypes.length > 0
      ) {
        apiParams.playerTypes = playerPreferenceFilters.playerTypes;
      }
      if (
        playerPreferenceFilters.preferences &&
        playerPreferenceFilters.preferences.length > 0
      ) {
        apiParams.gamePreferences = playerPreferenceFilters.preferences;
      }

      const response = await searchGolfers(apiParams);
      const fetchedUsers = response.users || [];

      setGolfers(fetchedUsers);
    } catch (err: any) {
      console.error("Error fetching golfers:", err);
      setError("Failed to fetch golfers. " + (err.message || ""));
      setGolfers([]);
    } finally {
      if (!isRefreshing) setIsLoading(false);
    }
  }, [
    user,
    currentLocation,
    debouncedSearchTerm,
    selectedLocation,
    distance,
    playerPreferenceFilters,
    isRefreshing,
  ]);

  useEffect(() => {
    if (user) {
      if (currentLocation && !selectedLocation) {
        return;
      }
      fetchAndSetGolfers();
    }
  }, [
    user,
    debouncedSearchTerm,
    selectedLocation,
    distance,
    playerPreferenceFilters,
    currentLocation,
  ]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchAndSetGolfers();
    setIsRefreshing(false);
  }, [fetchAndSetGolfers]);


  return (
    <View style={styles.container}>
      <View style={styles.searchFilterContainer}>
        <View style={styles.searchBarContainer}>
          <Ionicons
            name="search"
            size={20}
            color={colors.text.secondary}
            style={styles.searchIcon}
          />
          <TextInput
            placeholder="Search Golfers"
            placeholderTextColor={colors.text.secondary}
            style={styles.searchInput}
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
        </View>
        <View style={styles.filterButtonsRow}>
          <TouchableOpacity
            style={styles.filterButtonContainer}
            onPress={() => setIsPreferencesModalVisible(true)}
          >
            <Ionicons
              name="options-outline"
              size={20}
              color={colors.text.primary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              selectedLocation?.name === "Selected Area" &&
                styles.activeFilterButton,
            ]}
            onPress={() => setIsLocationModalVisible(true)}
          >
            <View style={styles.locationFilterContent}>
              <Ionicons
                name="location"
                size={16}
                color={
                  selectedLocation?.name === "Selected Area"
                    ? colors.neutral.black
                    : colors.text.primary
                }
                style={styles.locationIcon}
              />
              <Text
                style={[
                  styles.filterButtonText,
                  selectedLocation?.name === "Selected Area" &&
                    styles.activeFilterButtonText,
                ]}
                numberOfLines={1}
              >
                {selectedLocation?.name || "Location"}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              styles.distanceButton,
              distance !== 50 && styles.activeFilterButton,
            ]}
            onPress={() => setIsDistanceModalVisible(true)}
          >
            <Text
              style={[
                styles.filterButtonText,
                distance !== 50 && styles.activeFilterButtonText,
              ]}
            >
              {distance === 50 ? "Distance" : `${distance}km`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <LocationFilterModal
        visible={isLocationModalVisible}
        onClose={() => setIsLocationModalVisible(false)}
        onSelectLocation={handleLocationSelect}
        selectedLocation={selectedLocation}
      />
      <DistanceModal
        visible={isDistanceModalVisible}
        onClose={() => setIsDistanceModalVisible(false)}
        onApplyDistance={handleDistanceChange}
        initialDistance={distance}
      />
      <PlayerPreferencesModal
        visible={isPreferencesModalVisible}
        onClose={() => setIsPreferencesModalVisible(false)}
        onApplyFilters={handleApplyPlayerPreferences}
        initialFilters={playerPreferenceFilters}
      />

      {isLoading && golfers.length === 0 && !isRefreshing && (
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="small" color={colors.text.primary} />
          <Text style={[styles.infoText, { marginTop: spacing.md }]}>
            Loading golfers...
          </Text>
        </View>
      )}

      {!isLoading && error && !isRefreshing && (
        <View style={styles.centeredContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!isLoading && !error && golfers.length === 0 && !isRefreshing && (
        <View style={styles.centeredContainer}>
          <Text style={styles.infoText}>
            {debouncedSearchTerm.trim() ||
            selectedLocation?.name !== "My Location" ||
            (selectedLocation &&
              selectedLocation.name !== "My Location" &&
              distance !== 50) ||
            playerPreferenceFilters.handicapRanges?.length ||
            playerPreferenceFilters.playerTypes?.length ||
            playerPreferenceFilters.preferences?.length
              ? "No golfers found matching your criteria."
              : "No golfers found. Try searching or adjusting filters."}
          </Text>
        </View>
      )}

      {((!isLoading && !error) || isRefreshing) && golfers.length > 0 && (
        <FlatList
          data={golfers}
          renderItem={({ item }) => <GolferCard golfer={item} />}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.text.primary}
              colors={[colors.text.primary]}
            />
          }
        />
      )}
      {isRefreshing && golfers.length === 0 && (
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="small" color={colors.text.primary} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.black, // Match image background
  },
  searchFilterContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md, // Add some padding at the top
    paddingBottom: spacing.md,
    backgroundColor: colors.neutral.black, // Ensure this part also has the dark bg
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral.surface, // Darker input background from image
    borderRadius: spacing.xl, // Fully rounded
    paddingHorizontal: spacing.md,
    height: 48, // Match image
    marginBottom: spacing.md,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.text.primary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
  },
  filterButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
    // justifyContent: "space-between", // This might be too much space
  },
  filterButtonContainer: {
    // For the filter icon button
    padding: spacing.sm,
    marginRight: spacing.sm,
    // backgroundColor: colors.neutral.surface, // If it needs a background
    // borderRadius: spacing.lg,
  },
  filterButton: {
    backgroundColor: colors.neutral.surface,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.xl,
    marginRight: spacing.sm,
    height: 36,
    justifyContent: "center",
  },
  filterButtonText: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.xs,
    fontFamily: typography.fontFamily.medium,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "center",
    padding: spacing.lg,
    marginTop: spacing.xxl,
  },
  infoText: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
    textAlign: "center",
  },
  errorText: {
    color: colors.semantic.error,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
    textAlign: "center",
  },
  listContentContainer: {
    paddingHorizontal: spacing.xs, // Minimal horizontal padding for the list itself
    paddingBottom: spacing.xxl, // Ensure space for the last card
  },
  activeFilterButton: {
    backgroundColor: colors.primary.yellow,
  },
  activeFilterButtonText: {
    color: colors.neutral.black,
    fontFamily: typography.fontFamily.medium,
  },
  locationFilterContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  locationIcon: {
    marginRight: spacing.xs,
  },
  distanceButton: {
    minWidth: 70,
  },
});
