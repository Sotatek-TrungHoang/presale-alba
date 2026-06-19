import React, { useState, useEffect } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { Text } from "react-native";
import { GolfCourse } from "../../../../../api/courses";
import { colors, spacing, typography } from "@/constants/theme";
import { useLocation } from "@/providers/LocationProvider";
import { useCoursesData } from "@/hooks/useCoursesData";
import { SearchInput } from "@/components/ui/SearchInput";
import { CourseResultCard } from "@/components/ui/CourseResultCard";
import { useRouter } from "expo-router";

export default function CoursesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 400);
  const router = useRouter();

  const { currentLocation, isLoadingLocation, locationError } = useLocation();

  const coursesData = useCoursesData({
    currentLocation,
    selectedLocation: null,
    searchTerm: debouncedSearchTerm,
  });

  const {
    closestCourses,
    searchResults,
    isLoadingClosest,
    isLoadingSearch,
    fetchClosestCourses,
    fetchSearchResults,
  } = coursesData;

  const isSearching = debouncedSearchTerm.trim().length > 0;

  useEffect(() => {
    if (currentLocation && !isSearching) {
      fetchClosestCourses();
    }
  }, [currentLocation, isSearching]);

  useEffect(() => {
    if (isSearching) {
      fetchSearchResults();
    }
  }, [debouncedSearchTerm]);

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

  const listData: GolfCourse[] = isSearching
    ? searchResults?.courses ?? []
    : closestCourses;
  const isLoading = isSearching ? isLoadingSearch : isLoadingClosest;

  return (
    <View style={styles.container}>
      <View style={styles.fixedInput}>
        <SearchInput
          placeholder="Search courses"
          value={searchTerm}
          onChangeText={setSearchTerm}
          leftIcon="search"
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
      </View>
      {isLoading ? (
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="small" color={colors.text.primary} />
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <CourseResultCard
              item={item}
              isSelected={false}
              onPress={() => router.push(`/course/${item.id}`)}
              index={index}
            />
          )}
          contentContainerStyle={styles.listContentContainer}
          ListEmptyComponent={
            <View style={styles.emptyStateContainer}>
              <Text style={styles.emptyStateText}>No courses found.</Text>
            </View>
          }
        />
      )}
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
  fixedInput: {
    width: "100%",
    backgroundColor: colors.neutral.black,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
    zIndex: 10,
  },
  listContentContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
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
});
