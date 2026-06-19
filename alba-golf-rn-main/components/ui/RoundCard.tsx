import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { colors, spacing, typography, borderRadius } from "@/constants/theme";
import { formatDate, formatPricePerPlayer } from "@/utils/formatters";

interface RoundCardPlayer {
  user_id: string;
  status: string;
}

interface RoundCardProps {
  id: string;
  name?: string | null;
  courseName: string | null;
  selectedDate: number | null;
  exactTime?: string | null;
  timeSlot?: string | null;
  playersNeeded: number;
  playersInGame: RoundCardPlayer[];
  costPerPlayer?: number | null;
}

type StatusVariant = "posted" | "filling" | "lastSpot" | "full";

interface StatusStyle {
  label: string;
  color: string;
  bg: string;
}

const getStatusStyle = (
  approved: number,
  total: number
): { variant: StatusVariant } & StatusStyle => {
  if (total > 0 && approved >= total) {
    return {
      variant: "full",
      label: "FULL",
      color: colors.primary.red,
      bg: "#3A2024",
    };
  }
  if (total > 0 && total - approved === 1) {
    return {
      variant: "lastSpot",
      label: "LAST SPOT",
      color: colors.primary.orange,
      bg: "#3D2A18",
    };
  }
  if (approved > 0) {
    return {
      variant: "filling",
      label: `FILLING ${approved}/${total}`,
      color: colors.primary.yellow,
      bg: "#3D3318",
    };
  }
  return {
    variant: "posted",
    label: "POSTED",
    color: colors.text.secondary,
    bg: colors.neutral.surface,
  };
};

const formatShortTime = (
  exactTime?: string | null,
  timeSlot?: string | null
): string => {
  if (exactTime) {
    const [hStr, mStr] = exactTime.split(":");
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr ?? "0", 10);
    if (!Number.isNaN(h)) {
      const suffix = h >= 12 ? "pm" : "am";
      const hour12 = h % 12 === 0 ? 12 : h % 12;
      return m
        ? `${hour12}:${mStr.padStart(2, "0")}${suffix}`
        : `${hour12}${suffix}`;
    }
  }
  switch (timeSlot) {
    case "EARLY_MORNING":
      return "Early morning";
    case "LATE_MORNING":
      return "Late morning";
    case "LUNCHTIME":
      return "Lunchtime";
    case "LATE_AFTERNOON":
      return "Afternoon";
    case "EVENING":
      return "Evening";
    default:
      return "Time TBC";
  }
};

export const RoundCard: React.FC<RoundCardProps> = ({
  id,
  name,
  courseName,
  selectedDate,
  exactTime,
  timeSlot,
  playersNeeded,
  playersInGame,
  costPerPlayer,
}) => {
  const approvedCount = playersInGame.filter(
    (p) => p.status === "APPROVED" || p.status === "CONFIRMED"
  ).length;
  const status = getStatusStyle(approvedCount, playersNeeded);

  const priceLabel = formatPricePerPlayer(costPerPlayer);
  const metaParts = [
    formatDate(selectedDate),
    formatShortTime(exactTime, timeSlot),
    priceLabel ? `${priceLabel}pp` : null,
  ].filter(Boolean);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => router.push(`/(app)/round/${id}` as any)}
      style={styles.card}
    >
      <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
        <Text style={[styles.statusText, { color: status.color }]}>
          {status.label}
        </Text>
      </View>
      <Text style={styles.titleText} numberOfLines={1}>
        {name?.trim() || courseName || "Course not set"}
      </Text>
      {name?.trim() && courseName ? (
        <Text style={styles.subtitleText} numberOfLines={1}>
          {courseName}
        </Text>
      ) : null}
      <Text style={styles.metaText} numberOfLines={1}>
        {metaParts.join(" · ")}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1A1A1C",
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  statusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: borderRadius.round,
    marginBottom: spacing.sm,
  },
  statusText: {
    fontSize: typography.fontSizes.xs,
    fontFamily: typography.fontFamily.semibold,
    letterSpacing: 0.5,
  },
  titleText: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.lg,
    fontFamily: typography.fontFamily.semibold,
    marginBottom: spacing.xs,
  },
  subtitleText: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
    marginBottom: spacing.xs,
  },
  metaText: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
  },
});

export default RoundCard;
