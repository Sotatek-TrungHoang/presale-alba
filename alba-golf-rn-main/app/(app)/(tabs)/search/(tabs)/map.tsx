import React, { useState, useRef, useEffect } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { Text } from "react-native";
import CoursesMap from "../../../../../components/CoursesMap";
import { GolfCourse } from "../../../../../api/courses";
import { colors, spacing, typography } from "@/constants/theme";
import { useLocation } from "@/providers/LocationProvider";
import { useCoursesData } from "@/hooks/useCoursesData";
import { SearchInput } from "@/components/ui/SearchInput";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { CourseSheetModal } from "@/components/modals/CourseSheetModal";
import { useRouter } from "expo-router";

const VIEW_MODES = {
  MAP: "map",
  SEARCH: "search",
} as const;
type ViewMode = (typeof VIEW_MODES)[keyof typeof VIEW_MODES];

export default function MapPage() {
  const [selectedCourse, setSelectedCourse] = useState<GolfCourse | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(VIEW_MODES.MAP);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 400);
  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
    description?: string;
  } | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const bottomSheetModalRef = useRef<BottomSheetModal>(null!);
  const router = useRouter();

  const { currentLocation, isLoadingLocation, locationError } = useLocation();

  const coursesData = useCoursesData({
    currentLocation,
    selectedLocation,
    searchTerm: debouncedSearchTerm,
  });

  const { fetchSearchResults } = coursesData;

  useEffect(() => {
    if (
      viewMode === VIEW_MODES.SEARCH &&
      debouncedSearchTerm.trim().length > 0
    ) {
      fetchSearchResults();
    }
  }, [viewMode, debouncedSearchTerm]);

  const handleCoursePress = (course: GolfCourse) => {
    setSelectedCourse(course);
    setIsModalVisible(true);
  };

  const handleCloseModal = () => {
    setIsModalVisible(false);
    setSelectedCourse(null);
  };

  const handleVisitPage = () => {
    if (selectedCourse) {
      setIsModalVisible(false);
      router.push(`/course/${selectedCourse.id}`);
      setSelectedCourse(null);
    }
  };

  const handleInputFocus = () => {
    if (viewMode === VIEW_MODES.MAP) {
      setViewMode(VIEW_MODES.SEARCH);
    }
  };

  const handleChevronPress = () => {
    setViewMode(VIEW_MODES.MAP);
    setSearchTerm("");
    Keyboard.dismiss();
  };

  const renderLocationRow = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.locationRow}
      onPress={() => {
        setSelectedLocation({
          latitude: item.latitude,
          longitude: item.longitude,
          description: item.name,
        });
        setSearchTerm(item.description || "");
        setViewMode(VIEW_MODES.MAP);
        Keyboard.dismiss();
      }}
    >
      <Ionicons
        name="location-outline"
        size={20}
        color={colors.text.secondary}
      />
      <Text style={styles.locationText}>{item.name}</Text>
    </TouchableOpacity>
  );

  if (isLoadingLocation) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="small" color={colors.text.primary} />
        <Text style={styles.infoText}>Getting your location...</Text>
      </View>
    );
  }

  if (locationError || !currentLocation) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.errorText}>
          {locationError || "Location unavailable."}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {viewMode === VIEW_MODES.MAP ? (
        <View style={[styles.floatingInput, { zIndex: 10 }]}>
          <SearchInput
            placeholder="Search for a location"
            value={searchTerm}
            onChangeText={setSearchTerm}
            onFocus={handleInputFocus}
            leftIcon="search"
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
        </View>
      ) : (
        <View style={styles.fixedInput}>
          <SearchInput
            placeholder="Search for a location"
            value={searchTerm}
            onChangeText={setSearchTerm}
            leftIcon="chevron-back"
            onLeftIconPress={handleChevronPress}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
        </View>
      )}
      {viewMode === VIEW_MODES.MAP && (
        <CoursesMap
          onCoursePress={handleCoursePress}
          initialLatitude={
            selectedLocation?.latitude ?? currentLocation.latitude
          }
          initialLongitude={
            selectedLocation?.longitude ?? currentLocation.longitude
          }
          initialZoom={10}
        />
      )}
      {viewMode === VIEW_MODES.SEARCH && (
        <FlatList
          data={coursesData.searchResults?.locations || []}
          keyExtractor={(_, idx) => `location-${idx}`}
          renderItem={renderLocationRow}
          contentContainerStyle={styles.locationListContentContainer}
          ListEmptyComponent={
            <View style={styles.emptyStateContainer}>
              <Text style={styles.emptyStateText}>No locations found.</Text>
            </View>
          }
        />
      )}
      <CourseSheetModal
        bottomSheetModalRef={bottomSheetModalRef}
        course={selectedCourse}
        onClose={handleCloseModal}
        onVisitPage={handleVisitPage}
        isVisible={isModalVisible}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.black,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.neutral.black,
  },
  infoText: {
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  errorText: {
    color: colors.semantic.error,
    marginTop: spacing.md,
    textAlign: "center",
  },
  floatingInput: {
    position: "absolute",
    top: 32,
    left: 16,
    right: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  fixedInput: {
    width: "100%",
    backgroundColor: colors.neutral.black,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
    zIndex: 10,
  },
  locationListContentContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: 2 * spacing.xxl,
  },
  emptyStateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: spacing.xl,
  },
  emptyStateText: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.md,
    textAlign: "center",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.surface,
  },
  locationText: {
    marginLeft: spacing.sm,
    color: colors.text.primary,
    fontSize: typography.fontSizes.md,
  },
});
