import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, spacing, typography } from "@/constants/theme";
import { GolfCourse } from "@/api/courses";
import { Ionicons } from "@expo/vector-icons";

type CourseResultCardProps = {
  item: GolfCourse;
  onPress: () => void;
  isSelected: boolean;
  index: number;
  animatedScale?: Animated.Value;
};

const CourseResultCard: React.FC<CourseResultCardProps> = ({
  item,
  onPress,
  isSelected,
  index,
  animatedScale,
}) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.stagger(50 * index, [
      Animated.timing(opacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY, index]);

  const renderPriceRating = () => {
    const rating = item.price_rating || 2;
    const icons = [];
    for (let i = 0; i < 3; i++) {
      icons.push(
        <Ionicons
          key={i}
          name="logo-usd"
          size={typography.fontSizes.md}
          color={i < rating ? colors.text.primary : colors.text.secondary}
          style={styles.poundIcon}
        />
      );
    }
    return <View style={styles.priceContainer}>{icons}</View>;
  };

  return (
    <Animated.View
      style={[
        { opacity, transform: [{ translateY }] },
        animatedScale && { transform: [{ scale: animatedScale }] },
      ]}
    >
      <Pressable
        onPress={onPress}
        style={[styles.pressableBase, isSelected && styles.selectedItem]}
      >
        <LinearGradient
          colors={["#2C2C2F", "#141518"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.gradient}
        >
          <View style={styles.contentContainer}>
            <View style={styles.headerRow}>
              <Text style={styles.courseName}>{item.name}</Text>
            </View>

            <View style={styles.detailsRow}>
              {item.distance !== undefined && (
                <Text style={styles.distanceText}>{`${
                  item.distance % 1 === 0
                    ? item.distance
                    : item.distance.toFixed(1)
                } km away`}</Text>
              )}
              {item.num_holes !== undefined && (
                <Text style={styles.detailText}>{item.num_holes} Holes</Text>
              )}
            </View>
            <View style={styles.secondDetailsAndPriceContainer}>
              <View style={styles.secondDetailsRow}>
                {item.course_par !== undefined && (
                  <Text style={styles.secondDetailText}>
                    {item.course_par} Par
                  </Text>
                )}
                {item.course_slope !== undefined &&
                  item.course_slope !== null && (
                    <Text style={styles.secondDetailText}>
                      {item.course_slope} Slope
                    </Text>
                  )}
              </View>

              {renderPriceRating()}
            </View>
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  pressableBase: {
    borderRadius: spacing.md,
    marginBottom: spacing.md,
    overflow: "hidden",
  },
  selectedItem: {
    borderColor: colors.primary.yellow,
  },
  gradient: {
    padding: spacing.md,
  },
  contentContainer: {
    backgroundColor: "transparent",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  courseName: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.fontSizes.lg,
    color: colors.text.primary,
    flexShrink: 1, 
    marginRight: spacing.sm,
  },
  distanceText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.primary.yellow,
  },
  detailsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  secondDetailsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  detailText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.text.secondary,
  },
  secondDetailText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.text.primary,
  },
  secondDetailsAndPriceContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.xs,
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  poundIcon: {
    marginRight: spacing.xxs,
  },
});

export { CourseResultCard };
