import React, { useRef, useEffect } from "react";
import {
  Animated,
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  Easing,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "@/constants/theme";
import { GolfCourse } from "@/api/courses";

interface CourseListItemProps {
  item: GolfCourse;
  isSelected: boolean;
  onPress: (item: GolfCourse) => void;
  index: number;
}

export const CourseListItem: React.FC<CourseListItemProps> = ({
  item,
  isSelected,
  onPress,
  index,
}) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        delay: 100 + index * 80,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 400,
        delay: 100 + index * 80,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <TouchableOpacity
        style={[styles.courseItem, isSelected && styles.courseItemSelected]}
        onPress={() => onPress(item)}
      >
        <View style={styles.courseInfo}>
          <Text style={styles.courseName}>{item.name}</Text>
          {item.distance && (
            <Text style={styles.courseDistance}>
              {item.distance.toFixed(1)} km away
            </Text>
          )}
          {item.address && (
            <Text style={styles.courseAddress}>{item.address}</Text>
          )}
        </View>
        <View style={styles.courseSelectionIndicator}>
          {isSelected ? (
            <Ionicons
              name="checkmark-circle"
              size={24}
              color={colors.primary.yellow}
            />
          ) : (
            <Ionicons
              name="add-circle-outline"
              size={24}
              color={colors.text.secondary}
            />
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
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
});
