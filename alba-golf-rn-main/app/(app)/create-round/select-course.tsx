import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  Text,
  Alert,
  FlatList,
  ActivityIndicator,
  Animated,
  Easing,
  Keyboard,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Heading, CourseResultCard } from "@/components/ui";
import { colors, spacing, typography } from "@/constants/theme";
import { router, useFocusEffect } from "expo-router";
import { SearchInput } from "@/components/ui/SearchInput";
import {
  GolfCourse,
  getSearchedCourses,
} from "@/api/courses";
import { getUsersFavouriteCourses } from "@/api/user";
import { useCreateGameStore } from "@/stores/createGameStore";
import { useProfileStore } from "@/stores/profileStore";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

export default function SelectCourseScreen() {
  const { selectedCourse, setSelectedCourse } = useCreateGameStore();
  const { profile } = useProfileStore();

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const [favoriteCourses, setFavoriteCourses] = useState<GolfCourse[]>([]);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(false);

  const [displayedCourses, setDisplayedCourses] = useState<GolfCourse[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);

  const fetchFavoriteCourses = useCallback(async () => {
    if (profile && profile.id) {
      setIsLoadingFavorites(true);
      try {
        const favCoursesData = await getUsersFavouriteCourses(profile.id);
        setFavoriteCourses(favCoursesData);
      } catch (error) {
        console.error("Error fetching favorite courses:", error);
        Alert.alert("Error", "Could not load your favorite courses.");
        setFavoriteCourses([]);
      } finally {
        setIsLoadingFavorites(false);
      }
    } else {
      setFavoriteCourses([]);
    }
  }, [profile]);

  const performCourseSearch = useCallback(async (query: string) => {
    setIsLoadingCourses(true);
    try {
      const searchResults = await getSearchedCourses(query);
      setDisplayedCourses(searchResults);
    } catch (error) {
      console.error("Error searching courses:", error);
      Alert.alert("Search Error", "Could not perform course search.");
      setDisplayedCourses([]);
    } finally {
      setIsLoadingCourses(false);
    }
  }, []);

  const headingOpacity = useRef(new Animated.Value(0)).current;
  const headingTranslateY = useRef(new Animated.Value(-20)).current;
  const searchOpacity = useRef(new Animated.Value(0)).current;
  const searchTranslateY = useRef(new Animated.Value(-20)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(new Animated.Value(20)).current;
  const screenExitOpacity = useRef(new Animated.Value(1)).current;
  const screenExitScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (debouncedSearchQuery.trim().length > 0) {
      performCourseSearch(debouncedSearchQuery);
    } else {
      setDisplayedCourses(favoriteCourses);
    }
  }, [debouncedSearchQuery, favoriteCourses, performCourseSearch]);

  useEffect(() => {
    fetchFavoriteCourses();
  }, [fetchFavoriteCourses]);

  useFocusEffect(
    useCallback(() => {
      headingOpacity.setValue(0);
      headingTranslateY.setValue(-20);
      searchOpacity.setValue(0);
      searchTranslateY.setValue(-20);
      contentOpacity.setValue(0);
      contentTranslateY.setValue(20);
      screenExitOpacity.setValue(1);
      screenExitScale.setValue(1);

      fetchFavoriteCourses();

      Animated.parallel([
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
      ]).start();
    }, [fetchFavoriteCourses])
  );

  const handleCourseSelection = (course: GolfCourse) => {
    setSelectedCourse(course);
    Animated.parallel([
      Animated.timing(screenExitOpacity, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(screenExitScale, {
        toValue: 0.95,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => {
      router.push("/create-round/review-round-details");
    });
  };

  const renderEmptyState = () => {
    if (searchQuery.trim() === "") {
      if (isLoadingFavorites) {
        return <ActivityIndicator size="small" color={colors.text.primary} />;
      }
      if (favoriteCourses.length === 0) {
        return (
          <View style={styles.centeredMessageContainer}>
            <Text style={styles.centeredMessageText}>
              Search for a course to get started.
            </Text>
          </View>
        );
      }
    } else {
      if (isLoadingCourses) {
        return <ActivityIndicator size="small" color={colors.text.primary} />;
      }
      if (displayedCourses.length === 0) {
        return (
          <View style={styles.centeredMessageContainer}>
            <Text style={styles.centeredMessageText}>
              No courses found for "{searchQuery}". Try a different search term.
            </Text>
          </View>
        );
      }
    }
    return null;
  };

  return (
    <Animated.View
      style={{
        flex: 1,
        opacity: screenExitOpacity,
        transform: [{ scale: screenExitScale }],
        backgroundColor: colors.neutral.black,
      }}
    >
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <Pressable style={{ flex: 1 }} onPress={Keyboard.dismiss}>
          <Animated.View
            style={[
              styles.headerContainer,
              {
                opacity: headingOpacity,
                transform: [{ translateY: headingTranslateY }],
              },
            ]}
          >
            <Heading level={2} weight="light">
              Where do you
            </Heading>
            <Heading level={2} weight="light">
              want to play?
            </Heading>
          </Animated.View>

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
              placeholder="Course name or address"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </Animated.View>

          <Animated.View
            style={[
              styles.listContainer,
              {
                opacity: contentOpacity,
                transform: [{ translateY: contentTranslateY }],
              },
            ]}
          >
            <FlatList
              data={displayedCourses}
              renderItem={({ item, index }) => (
                <CourseResultCard
                  item={item}
                  isSelected={selectedCourse?.id === item.id}
                  onPress={() => handleCourseSelection(item)}
                  index={index}
                />
              )}
              keyExtractor={(item) => item.id.toString()}
              ListEmptyComponent={renderEmptyState}
              contentContainerStyle={styles.listContentContainer}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          </Animated.View>
        </Pressable>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.black,
  },
  headerContainer: {
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  searchSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    zIndex: 10,
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  listContentContainer: {
    paddingBottom: spacing.xxl,
  },
  centeredMessageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  centeredMessageText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSizes.md,
    color: colors.text.secondary,
    textAlign: "center",
  },
});
