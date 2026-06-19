import React from "react";
import { View, Text, StyleSheet, Modal, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "@/constants/theme";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { GolfCourse } from "@/api/courses";

type CourseSheetModalProps = {
  onClose: () => void;
  course: GolfCourse | null;
  onVisitPage: () => void;
  bottomSheetModalRef: React.RefObject<any>; // Keep for compatibility but not used
  isVisible: boolean;
};

export const CourseSheetModal: React.FC<CourseSheetModalProps> = ({
  onClose,
  course,
  onVisitPage,
  bottomSheetModalRef,
  isVisible,
}) => {
  const renderPriceRating = () => {
    if (!course?.price_rating) return null;
    const rating = course.price_rating;
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
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          style={styles.modalContent}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={onClose}
            testID="close-button"
            accessibilityLabel="Close"
          >
            <Ionicons
              name="close-outline"
              size={30}
              color={colors.text.primary}
            />
          </TouchableOpacity>

          <View style={styles.courseContainer}>
            {course && (
              <>
                  <View style={styles.courseContent}>
                    <View style={styles.headerRow}>
                      <Text style={styles.courseName}>{course.name}</Text>
                    </View>

                    <View style={styles.detailsRow}>
                      {course.distance !== undefined && (
                        <Text style={styles.distanceText}>{`${
                          course.distance % 1 === 0
                            ? course.distance
                            : course.distance.toFixed(1)
                        } km away`}</Text>
                      )}
                      {course.num_holes !== undefined && (
                        <Text style={styles.detailText}>
                          {course.num_holes} Holes
                        </Text>
                      )}
                    </View>

                    <View style={styles.secondDetailsAndPriceContainer}>
                      <View style={styles.secondDetailsRow}>
                        {course.course_par !== undefined && (
                          <Text style={styles.secondDetailText}>
                            {course.course_par} Par
                          </Text>
                        )}
                        {course.course_slope !== undefined &&
                          course.course_slope !== null && (
                            <Text style={styles.secondDetailText}>
                              {course.course_slope} Slope
                            </Text>
                          )}
                      </View>
                      {renderPriceRating()}
                    </View>
                  </View>
                <SubmitButton title="Visit Page" onPress={onVisitPage} />
              </>
            )}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.neutral.surface,
    borderTopLeftRadius: spacing.lg,
    borderTopRightRadius: spacing.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalCloseButton: {
    position: "absolute",
    top: spacing.lg,
    right: spacing.lg,
    zIndex: 1,
  },
  courseContainer: {
    borderRadius: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
    gap: spacing.lg,
  },
  courseContent: {
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
