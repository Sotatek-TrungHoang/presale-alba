import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Platform,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { colors, spacing, typography } from "@/constants/theme";
import {
  DetailedGolfCourse,
  getGolfCourseDetails,
  Profile,
  UserOnboarding,
} from "@/api/courses";
import { GameListing } from "@/components/ui/GameListing";
import GolferCard from "@/components/ui/GolferCard";
import { LinearGradient } from "expo-linear-gradient";
import { Heading } from "@/components/ui";
import { Ionicons } from "@expo/vector-icons";
import { CircleButton } from "@/components/ui";
import { router } from "expo-router";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import ReactNativeSafeAreaContext from "react-native-safe-area-context";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCreateGameStore } from "@/stores/createGameStore";
import { useGettingStartedChecklist } from "@/hooks/useGettingStartedChecklist";

const TABS = ["Rounds", "Golfers"] as const;
type Tab = (typeof TABS)[number];

export default function CoursePage() {
  const { id } = useLocalSearchParams();
  const [course, setCourse] = useState<DetailedGolfCourse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("Rounds");
  const tabBarHeight = React.useContext(BottomTabBarHeightContext) ?? 0;
  const insets = useSafeAreaInsets();
  const bottomOffset = (tabBarHeight || insets.bottom || 0) + 20;
  const { resetCreateGame, setSelectedCourse, setCourseLocked } =
    useCreateGameStore();
  const { stripeActive } = useGettingStartedChecklist();

  const handleOrganiseRound = () => {
    if (!course) return;
    resetCreateGame();
    setSelectedCourse({
      id: course.id,
      name: course.name,
      address: course.address ?? undefined,
      price_rating: course.price_rating,
      num_holes: course.num_holes,
      course_par: course.course_par,
      course_slope: course.course_slope,
      lat: course.lat ?? undefined,
      lng: course.lng ?? undefined,
    });
    setCourseLocked(true);
    if (stripeActive) {
      router.push("/create-round" as any);
    } else {
      router.push("/stripe-onboarding" as any);
    }
  };

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    getGolfCourseDetails(String(id))
      .then((data) => setCourse(data))
      .catch((err) => setError("Failed to load course details"))
      .finally(() => setLoading(false));
  }, [id]);

  if (!id || loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.text.primary} />
        <Text style={styles.loadingText}>Loading course...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!course) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Course not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#2C2C2F", "#000000"]}
        style={styles.headerGradient}
      >
        <View style={styles.headerContent}>
          <Heading level={2} weight="bold">
            {course.name}
          </Heading>
          <Text style={styles.courseAddress}>{course.address}</Text>
          <View style={styles.courseSummaryRow}>
            {course.course_par && (
              <Text style={styles.summaryText}>{course.course_par} Par</Text>
            )}
            {course.course_slope && (
              <Text style={styles.summaryText}>{course.course_slope} SR</Text>
            )}
            <View style={styles.priceContainer}>
              {[0, 1, 2].map((i) => (
                <Ionicons
                  key={i}
                  name="logo-usd"
                  size={typography.fontSizes.md}
                  color={
                    i < (course.price_rating ?? 2)
                      ? colors.text.primary
                      : colors.text.secondary
                  }
                  style={styles.poundIcon}
                />
              ))}
            </View>
          </View>
        </View>
      </LinearGradient>
      {/* Tabs */}
      <View style={styles.tabsRow}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.tabButton,
              activeTab === tab && styles.activeTabButton,
            ]}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab && styles.activeTabText,
              ]}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {/* Tab Content */}
      <View style={styles.tabContent}>
        {activeTab === "Rounds" ? (
          course.games && course.games.length > 0 ? (
            <FlatList
              data={course.games}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <GameListing
                  id={item.id}
                  name={item.name ?? null}
                  playersNeeded={item.players_needed}
                  timeSlot={item.time_slot ?? null}
                  gameType={item.game_type}
                  gameFormat={item.game_format ?? null}
                  courseName={course.name}
                  courseId={course.id}
                  reviewCard={false}
                  selectedDate={
                    item.date ? new Date(item.date).getTime() : null
                  }
                  playersInGame={item.players.map((p) => ({
                    ...p,
                    user: {
                      ...p.user,
                      profile: p.user.profile ?? null,
                    },
                  }))}
                  creatorId={item.creator?.id}
                  exact_time={item.exact_time ?? null}
                />
              )}
              contentContainerStyle={{ paddingBottom: spacing.xl }}
            />
          ) : (
            <Text style={styles.placeholderText}>
              No rounds for this course yet.
            </Text>
          )
        ) : course.favourites && course.favourites.length > 0 ? (
          <FlatList
            data={course.favourites}
            keyExtractor={(_, idx) => String(idx)}
            renderItem={({ item }) => {
              const user = item.user;
              const profile: Profile | null = user.profile ?? null;
              const onboarding: UserOnboarding | null = user.onboarding ?? null;
              const golferUser = {
                id: user.id,
                profile,
                onboarding,
              };
              return <GolferCard golfer={golferUser} />;
            }}
            contentContainerStyle={{ paddingBottom: spacing.xl }}
          />
        ) : (
          <Text style={styles.placeholderText}>
            No golfers have favourited this course yet.
          </Text>
        )}
      </View>
      <View style={[styles.fabContainerBase, { bottom: bottomOffset }]}>
        <CircleButton onPress={handleOrganiseRound} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.black,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.neutral.black,
  },
  loadingText: {
    color: colors.text.secondary,
    marginTop: spacing.md,
    fontSize: typography.fontSizes.md,
  },
  errorText: {
    color: colors.semantic.error,
    fontSize: typography.fontSizes.md,
  },
  header: {
    padding: spacing.lg,
    borderTopLeftRadius: spacing.lg,
    borderTopRightRadius: spacing.lg,
  },
  headerContent: {
    alignItems: "center",
    gap: spacing.sm,
  },
  headerGradient: {
    borderTopLeftRadius: spacing.lg,
    borderTopRightRadius: spacing.lg,
    padding: spacing.lg,
  },
  courseName: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.xxl,
    fontFamily: typography.fontFamily.bold,
    marginBottom: spacing.xs,
  },
  courseAddress: {
    color: colors.primary.yellow,
    fontSize: typography.fontSizes.md,
    marginBottom: spacing.sm,
    alignSelf: "center",
    alignContent: "center",
    textAlign: "center",
  },
  courseSummaryRow: {
    flexDirection: "row",
    gap: spacing.lg,
    alignItems: "center",
    alignContent: "center",
    justifyContent: "space-between",
  },
  summaryText: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.lg,
    fontFamily: typography.fontFamily.light,
  },
  tabsRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.black,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTabButton: {
    borderBottomColor: colors.primary.orange,
  },
  tabText: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.lg,
    fontFamily: typography.fontFamily.light,
  },
  activeTabText: {
    color: colors.text.primary,
  },
  tabContent: {
    flex: 1,
    padding: spacing.sm,
  },
  placeholderText: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.md,
    textAlign: "center",
    marginTop: spacing.xl,
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  poundIcon: {
    marginRight: spacing.xxs,
    marginTop: -2, // Adjust this value if needed for perfect alignment
  },
  fabContainerBase: {
    position: "absolute",
    right: 20,
  },
});
