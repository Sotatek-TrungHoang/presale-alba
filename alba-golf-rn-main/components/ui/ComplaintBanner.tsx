import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "@/constants/theme";
import { ComplaintStatus } from "@/types/complaints";

interface ComplaintBannerProps {
  status: ComplaintStatus;
  description: string;
  resolution?: string;
}

const getStatusConfig = (status: ComplaintStatus) => {
  switch (status) {
    case "PENDING":
      return {
        icon: "time-outline",
        color: colors.primary.yellow,
        text: "Pending Review",
        backgroundColor: colors.primary.yellow + "20",
        footerText:
          "Support will review your complaint and contact you if needed.",
      };
    case "IN_REVIEW":
      return {
        icon: "eye-outline",
        color: colors.primary.yellow,
        text: "Under Review",
        backgroundColor: colors.primary.yellow + "20",
        footerText:
          "Support are reviewing your complaint and will contact you if needed.",
      };
    case "RESOLVED":
      return {
        icon: "checkmark-circle-outline",
        color: colors.semantic.success,
        text: "Resolved",
        backgroundColor: colors.semantic.success + "20",
        footerText:
          "Thank you for helping us improve our service.",
      };
    case "REFUNDED":
      return {
        icon: "card-outline",
        color: colors.semantic.success,
        text: "Refund Issued",
        backgroundColor: colors.semantic.success + "20",
        footerText:
          "Thank you for helping us improve our service.",
      };
    case "REJECTED":
      return {
        icon: "close-circle-outline",
        color: colors.semantic.error,
        text: "Rejected",
        backgroundColor: colors.semantic.error + "20",
        footerText:
          "Thank you for helping us improve our service.",
      };
    default:
      return {
        icon: "information-circle-outline",
        color: colors.text.secondary,
        text: "Unknown Status",
        backgroundColor: colors.text.secondary + "20",
        footerText:
          "Please contact support if you believe this is an error.",
      };
  }
};

export const ComplaintBanner: React.FC<ComplaintBannerProps> = ({
  status,
  description,
  resolution,
}) => {
  const statusConfig = getStatusConfig(status);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: statusConfig.backgroundColor },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons
            name={statusConfig.icon as any}
            size={20}
            color={statusConfig.color}
          />
        </View>
        <View style={styles.content}>
          <Text style={[styles.status, { color: statusConfig.color }]}>
            {statusConfig.text}
          </Text>
        </View>
      </View>

      {resolution && (
        <View style={styles.detailsSection}>
          <Text style={styles.detailsLabel}>Resolution:</Text>
          <Text style={styles.detailsText}>{resolution}</Text>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {statusConfig.footerText}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.md,
    marginVertical: spacing.md,
    padding: spacing.md,
    borderRadius: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral.surfaceSecondary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  iconContainer: {
    marginRight: spacing.sm,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  title: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.fontSizes.md,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  status: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSizes.sm,
  },
  detailsSection: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.surfaceSecondary,
  },
  detailsLabel: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.fontSizes.sm,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  detailsText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  footer: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.surfaceSecondary,
  },
  footerText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.text.secondary,
    fontStyle: "italic",
  },
});
