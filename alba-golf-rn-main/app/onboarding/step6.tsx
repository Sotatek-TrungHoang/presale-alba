import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  Text,
  Alert,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SubmitButton, Heading } from "@/components/ui";
import { colors, spacing, typography } from "@/constants/theme";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SearchInput } from "@/components/ui/SearchInput";
import {
  getNearbyCourses,
  GolfCourse,
  Location as LocationType,
} from "@/api/courses";

import { useOnboardingStore } from "@/stores/onboardingStore";
import { useLocation } from "@/providers/LocationProvider";
import { searchLocations } from "@/api/location";
import { CourseListItem } from "@/components/ui/CourseListItem";

// Custom hook for debouncing values
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set debouncedValue to value (passed in) after the specified delay
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Return a cleanup function that will be called every time useEffect is re-called
    // This prevents the setTimeout from being executed if the value changes within the delay period
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function OnboardingStep6() {
  // Get state and actions from our store
  const { selectedCourse, setSelectedCourse } = useOnboardingStore();

  // --- Use Location from Provider ---
  const {
    currentLocation: providerCurrentLocation, // Renamed to avoid clash with old state if any
    isLoadingLocation: providerIsLoadingLocation,
    locationError: providerLocationError,
    // requestLocationPermission: providerRequestPermission, // Can be used for a retry button
  } = useLocation();
  // --- End Use Location from Provider ---

  // State for this screen
  const [selectedLocation, setSelectedLocation] = useState<LocationType | null>(
    null
  ); // User-selected location from search
  const [nearbyCourses, setNearbyCourses] = useState<GolfCourse[]>([]);
  const [localSelectedCourse, setLocalSelectedCourse] =
    useState<GolfCourse | null>(selectedCourse);

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [locationResults, setLocationResults] = useState<LocationType[]>([]);

  const [isLoadingCourses, setIsLoadingCourses] = useState(false); // For when getNearbyCourses is running
  const [isSearching, setIsSearching] = useState(false); // For when searchLocations (manual search) is running

  // --- Animation Values ---
  const headingOpacity = useRef(new Animated.Value(0)).current;
  const headingTranslateY = useRef(new Animated.Value(-20)).current;

  const searchOpacity = useRef(new Animated.Value(0)).current;
  const searchTranslateY = useRef(new Animated.Value(-20)).current;

  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(new Animated.Value(20)).current;

  const summaryOpacity = useRef(new Animated.Value(0)).current;
  const summaryTranslateY = useRef(new Animated.Value(20)).current;

  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonTranslateY = useRef(new Animated.Value(30)).current;
  // ------------------------

  // Search for locations when debounced query changes
  useEffect(() => {
    if (debouncedSearchQuery.length > 2) {
      searchForLocations(debouncedSearchQuery);
    } else {
      setLocationResults([]);
    }
  }, [debouncedSearchQuery]);

  // Load nearby courses when provider's location or user's selectedLocation changes
  useEffect(() => {
    const locationToLoad = selectedLocation || providerCurrentLocation;
    if (locationToLoad) {
      loadNearbyCourses(locationToLoad);
    }
    // If !locationToLoad and !providerIsLoadingLocation and providerLocationError, it means an error from provider.
    // If !locationToLoad and providerIsLoadingLocation, it means provider is still fetching.
    // Handled by UI rendering logic.
  }, [providerCurrentLocation, selectedLocation]); // providerIsLoadingLocation removed, handled by UI

  // Apply entrance animations when screen focuses
  useFocusEffect(
    useCallback(() => {
      // Reset all animation values (except summary, handled separately)
      headingOpacity.setValue(0);
      headingTranslateY.setValue(-20);
      searchOpacity.setValue(0);
      searchTranslateY.setValue(-20);
      contentOpacity.setValue(0);
      contentTranslateY.setValue(20);
      // summaryOpacity.setValue(0); // Handled by useEffect below
      // summaryTranslateY.setValue(20); // Handled by useEffect below
      buttonOpacity.setValue(0);
      buttonTranslateY.setValue(30);

      // Define animations
      const headingAnim = Animated.parallel([
        Animated.timing(headingOpacity, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(headingTranslateY, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]);

      const searchAnim = Animated.parallel([
        Animated.timing(searchOpacity, {
          toValue: 1,
          duration: 500,
          delay: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(searchTranslateY, {
          toValue: 0,
          duration: 500,
          delay: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]);

      const contentAnim = Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 500,
          delay: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(contentTranslateY, {
          toValue: 0,
          duration: 500,
          delay: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]);

      // Summary animation definition (not started here)
      const summaryAnim = Animated.parallel([
        Animated.timing(summaryOpacity, {
          toValue: 1,
          duration: 400,
          delay: 400, // Delay slightly after content
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(summaryTranslateY, {
          toValue: 0,
          duration: 400,
          delay: 400,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]);

      const buttonAnim = Animated.parallel([
        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 500,
          delay: 500, // Delay after summary/content
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(buttonTranslateY, {
          toValue: 0,
          duration: 500,
          delay: 500,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]);

      // Start animations
      Animated.parallel([
        headingAnim,
        searchAnim,
        contentAnim,
        // summaryAnim is started conditionally based on localSelectedCourses.length
        buttonAnim,
      ]).start();

      // Animate summary section based on selection count
      if (localSelectedCourse) {
        // Animate IN
        Animated.parallel([
          Animated.timing(summaryOpacity, {
            toValue: 1,
            duration: 300,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(summaryTranslateY, {
            toValue: 0,
            duration: 300,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]).start();
      } else {
        // Animate OUT
        Animated.parallel([
          Animated.timing(summaryOpacity, {
            toValue: 0,
            duration: 300,
            easing: Easing.in(Easing.ease), // Use 'in' for exit
            useNativeDriver: true,
          }),
          Animated.timing(summaryTranslateY, {
            toValue: 20, // Back to initial offset
            duration: 300,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]).start();
      }

      // Optional cleanup
      // return () => { /* Animation cleanup if needed */ };
    }, []) // Empty dependency array: runs only on focus/blur
  );

  // Animate summary section based on selection count
  useEffect(() => {
    const targetOpacity = localSelectedCourse ? 1 : 0;
    const targetTranslateY = localSelectedCourse ? 0 : 20;

    Animated.parallel([
      Animated.timing(summaryOpacity, {
        toValue: targetOpacity,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(summaryTranslateY, {
        toValue: targetTranslateY,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [localSelectedCourse]);

  // Search for locations using the API
  const searchForLocations = async (query: string) => {
    setIsSearching(true);
    try {
      const results = await searchLocations(query);
      setLocationResults(results);
    } catch (error) {
      console.error("Error searching locations:", error);
      Alert.alert("Error", "Failed to search for locations. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  // Load nearby golf courses using the selected or current location
  const loadNearbyCourses = async (location: LocationType) => {
    setIsLoadingCourses(true);
    try {
      const courses = await getNearbyCourses(
        location.latitude,
        location.longitude
      );
      setNearbyCourses(courses);
    } catch (error) {
      console.error("Error loading nearby courses:", error);
      Alert.alert(
        "Error",
        "Failed to load nearby golf courses. Please try again."
      );
    } finally {
      setIsLoadingCourses(false);
    }
  };

  // Select a location from search results
  const selectLocation = (location: LocationType) => {
    setSelectedLocation(location);
    setSearchQuery("");
    setLocationResults([]);
  };

  // Toggle course selection
  const toggleCourseSelection = (course: GolfCourse) => {
    if (localSelectedCourse?.id === course.id) {
      // Remove course if already selected
      setLocalSelectedCourse(
        null
      );
    } else {
      // Add course if not already selected
      setLocalSelectedCourse(course);
    }
  };

  // Continue to next step
  const handleSubmit = () => {
    // Update the global store with selected courses
    setSelectedCourse(localSelectedCourse);

    // Navigate to the next step
    router.push("/onboarding/step7");
  };

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <View style={styles.formContainer}>
        <Animated.View
          style={[
            styles.headerSection,
            {
              opacity: headingOpacity,
              transform: [{ translateY: headingTranslateY }],
            },
          ]}
        >
          <Heading level={1} weight="light">
            Select your
          </Heading>
          <Heading level={1} weight="light">
            home course
          </Heading>
          <Text style={styles.subheading}>
            We'll recommend rounds here more often
          </Text>
        </Animated.View>

        {/* Location search input */}
        <Animated.View
          style={[
            styles.searchSection,
            {
              opacity: searchOpacity,
              transform: [{ translateY: searchTranslateY }],
            },
          ]}
        >
          <SearchInput
            placeholder="Search for another location"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          {/* Show location results when searching and no result selected yet */}
          {searchQuery.length > 0 &&
            locationResults.length > 0 &&
            !selectedLocation && (
              <View style={styles.searchResultsContainer}>
                {isSearching ? (
                  <ActivityIndicator
                    color={colors.neutral.white}
                    style={styles.loadingIndicator}
                  />
                ) : (
                  <FlatList
                    data={locationResults}
                    keyExtractor={(item, index) =>
                      `location-${index}-${item.latitude}-${item.longitude}`
                    }
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.searchResultItem}
                        onPress={() => selectLocation(item)}
                      >
                        <Ionicons
                          name="location"
                          size={16}
                          color={colors.text.secondary}
                          style={styles.resultIcon}
                        />
                        <Text style={styles.searchResultText}>
                          {item.description ||
                            `${
                              item.latitude !== undefined
                                ? item.latitude.toFixed(2)
                                : "N/A"
                            }, ${
                              item.longitude !== undefined
                                ? item.longitude.toFixed(2)
                                : "N/A"
                            }`}
                        </Text>
                      </TouchableOpacity>
                    )}
                  />
                )}
              </View>
            )}
        </Animated.View>

        {/* Decide what main content to show based on search state and selected location */}
        <Animated.View
          style={[
            styles.contentFlexContainer,
            {
              opacity: contentOpacity,
              transform: [{ translateY: contentTranslateY }],
            },
          ]}
        >
          {(selectedLocation || (!searchQuery && providerCurrentLocation)) &&
            !providerIsLoadingLocation && (
              // Show course list if we have a selected location OR (no search query AND provider has a location)
              // AND provider is not loading.
              <>
                {/* Location indicator - show for selected location or current location from provider */}
                {(selectedLocation || providerCurrentLocation) && (
                  <View style={styles.locationIndicator}>
                    <Ionicons
                      name="location"
                      size={16}
                      color={colors.text.secondary}
                    />
                    <Text style={styles.locationText}>
                      {selectedLocation
                        ? selectedLocation.description
                        : "Current location"}
                    </Text>
                    {selectedLocation && (
                      <TouchableOpacity
                        style={styles.resetLocationButton}
                        onPress={() => setSelectedLocation(null)} // This will trigger useEffect to use providerCurrentLocation
                      >
                        <Text style={styles.resetLocationText}>Reset</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Nearby courses list */}
                <View style={styles.coursesContainer}>
                  {isLoadingCourses ? (
                    <ActivityIndicator
                      color={colors.neutral.white}
                      style={styles.loadingIndicator}
                    />
                  ) : nearbyCourses.length > 0 ? (
                    <FlatList
                      data={nearbyCourses}
                      keyExtractor={(item) => item.id}
                      renderItem={({ item, index }) => {
                        const isSelected = localSelectedCourse?.id === item.id
                        
                        return (
                          <CourseListItem
                            item={item}
                            isSelected={isSelected}
                            onPress={toggleCourseSelection}
                            index={index}
                          />
                        );
                      }}
                      contentContainerStyle={styles.coursesList}
                      ListEmptyComponent={
                        // This should ideally not be reached if isLoadingCourses is false and nearbyCourses is empty
                        <Text style={styles.emptyStateText}>
                          No courses found for this location.
                        </Text>
                      }
                    />
                  ) : (
                    <Text style={styles.emptyStateText}>
                      No courses found for this location.
                    </Text>
                  )}
                </View>
              </>
            )}

          {/* Loading state from Provider if no selectedLocation and no active search query */}
          {!selectedLocation &&
            searchQuery.length === 0 &&
            providerIsLoadingLocation && (
              <View style={styles.fullSizeSearchResults}>
                <ActivityIndicator
                  color={colors.neutral.white}
                  style={styles.loadingIndicator}
                />
                <Text style={styles.instructionText}>
                  Finding your location...
                </Text>
              </View>
            )}

          {/* Error state from Provider if no selectedLocation and no active search query */}
          {!selectedLocation &&
            searchQuery.length === 0 &&
            providerLocationError &&
            !providerIsLoadingLocation && (
              <View style={styles.fullSizeSearchResults}>
                <Text style={styles.emptyStateText}>
                  Location Error: {providerLocationError}
                </Text>
                {/* TODO: Add a button to retry permission/fetch using funcs from useLocation() */}
              </View>
            )}

          {/* Manual Search Results or Empty State for Manual Search (when searchQuery is active) */}
          {searchQuery.length > 0 && !selectedLocation && (
            <View style={styles.fullSizeSearchResults}>
              {isSearching && (
                <ActivityIndicator
                  color={colors.neutral.white}
                  style={styles.loadingIndicator}
                />
              )}
              {!isSearching &&
                locationResults.length === 0 &&
                debouncedSearchQuery.length > 0 && (
                  <Text style={styles.emptyStateText}>
                    No locations found for "{debouncedSearchQuery}". Try a
                    different search term.
                  </Text>
                )}
              {/* Location results list is rendered inside the searchSection if conditions are met */}
            </View>
          )}
        </Animated.View>

        {/* Continue button */}
        <Animated.View
          style={[
            styles.buttonSection,
            {
              opacity: buttonOpacity,
              transform: [{ translateY: buttonTranslateY }],
            },
          ]}
        >
          <SubmitButton
            title={"Continue"}
            disabled={!localSelectedCourse}
            onPress={handleSubmit}
          />
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.black,
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerSection: {
    alignItems: "center",
    marginBottom: spacing.md,
    paddingTop: spacing.sm,
  },
  subheading: {
    fontSize: typography.fontSizes.sm,
    color: colors.text.secondary,
    marginTop: Platform.OS === "ios" ? spacing.sm : 0,
    textAlign: "center",
  },
  searchSection: {
    zIndex: 10,
    // marginBottom: spacing.md,
  },
  searchResultsContainer: {
    position: "absolute",
    top: 70,
    left: 0,
    right: 0,
    backgroundColor: colors.neutral.surface,
    borderRadius: 8,
    maxHeight: 180,
    zIndex: 20,
    overflow: "hidden",
  },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.black,
  },
  resultIcon: {
    marginRight: spacing.sm,
  },
  searchResultText: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamily.regular,
  },
  loadingIndicator: {
    padding: spacing.md,
  },
  locationIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral.surface,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  locationText: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamily.regular,
    marginLeft: spacing.sm,
    flex: 1,
  },
  resetLocationButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.neutral.black,
    borderRadius: 4,
  },
  resetLocationText: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.xs,
    fontFamily: typography.fontFamily.medium,
  },
  coursesContainer: {
    flex: 1,
    marginBottom: 0,
  },
  sectionTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.medium,
    marginBottom: spacing.sm,
  },
  coursesList: {
    paddingBottom: spacing.lg,
  },
  courseItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.neutral.surface,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  courseItemSelected: {
    borderWidth: 1,
    borderColor: colors.primary.yellow,
  },
  courseInfo: {
    flex: 1,
  },
  courseName: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.medium,
  },
  courseDistance: {
    color: colors.primary.yellow,
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamily.regular,
    marginTop: spacing.xs,
  },
  courseAddress: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.xs,
    fontFamily: typography.fontFamily.regular,
    marginTop: spacing.xs,
  },
  courseSelectionIndicator: {
    marginLeft: spacing.sm,
  },
  emptyStateText: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamily.regular,
    textAlign: "center",
    marginTop: spacing.xl,
  },
  selectionBadge: {
    position: "absolute",
    top: spacing.md, // Adjust as needed
    right: spacing.md, // Adjust as needed
    backgroundColor: colors.neutral.surface,
    borderRadius: 20,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 10,
    shadowColor: colors.neutral.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  selectionBadgeContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  selectionBadgeText: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamily.medium,
    marginLeft: spacing.xs,
  },
  buttonSection: {
    paddingBottom: spacing.lg,
  },
  fullSizeSearchResults: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  instructionText: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
    textAlign: "center",
  },
  contentFlexContainer: {
    flex: 1,
    marginBottom: spacing.md,
  },
  selectionChip: {
    alignSelf: "flex-start",
    backgroundColor: colors.neutral.surface,
    borderRadius: 12,
    borderColor: colors.primary.yellow,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
    // marginTop: spacing.sm,
  },
  selectionChipText: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.xs,
    fontFamily: typography.fontFamily.medium,
  },
});
