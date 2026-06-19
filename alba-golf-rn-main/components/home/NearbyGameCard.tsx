import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { colors, spacing, typography, borderRadius } from "@/constants/theme";
import {
  formatDate,
  formatPricePerPlayer,
  formatRelativeTime,
} from "@/utils/formatters";

interface NearbyGamePlayer {
  user_id: string;
  user: {
    id: string;
    profile: { first_name?: string | null; photo?: string | null } | null;
  };
  status: string;
  created_at?: string | null;
}

interface NearbyGameCardProps {
  id: string;
  name?: string | null;
  courseName: string | null;
  selectedDate: number | null;
  exactTime?: string | null;
  timeSlot?: string | null;
  playersNeeded: number;
  playersInGame: NearbyGamePlayer[];
  costPerPlayer?: number | null;
  latestPlayerCreatedAt?: string | null;
}

const AVATAR_PALETTE = [
  { bg: "#A23E48", border: "#D9656F" },
  { bg: "#2E5C8A", border: "#4F86C2" },
  { bg: "#5C7A2E", border: "#8AB256" },
  { bg: "#7A3E8A", border: "#A668B6" },
];

const pickAvatarColor = (userId: string) => {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
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
      return m ? `${hour12}:${mStr.padStart(2, "0")}${suffix}` : `${hour12}${suffix}`;
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

const getStatus = (approved: number, total: number) => {
  if (total <= 0) return { label: "OPEN", color: colors.primary.yellow, bg: "#3D3318" };
  if (approved >= total) return { label: "FULL", color: colors.primary.red, bg: "#3A2024" };
  if (total - approved === 1) return { label: "LAST SPOT", color: colors.primary.orange, bg: "#3D2A18" };
  if (approved > 0) return { label: "FILLING", color: colors.primary.yellow, bg: "#3D3318" };
  return { label: "OPEN", color: colors.primary.yellow, bg: "#3D3318" };
};

export const NearbyGameCard: React.FC<NearbyGameCardProps> = ({
  id,
  name,
  courseName,
  selectedDate,
  exactTime,
  timeSlot,
  playersNeeded,
  playersInGame,
  costPerPlayer,
  latestPlayerCreatedAt,
}) => {
  const approvedPlayers = playersInGame.filter(
    (p) => p.status === "APPROVED" || p.status === "CONFIRMED"
  );
  const approvedCount = approvedPlayers.length;
  const spotsLeft = Math.max(playersNeeded - approvedCount, 0);
  const status = getStatus(approvedCount, playersNeeded);
  const priceLabel = formatPricePerPlayer(costPerPlayer);
  const latestPlayer = playersInGame[0];
  const latestPlayerName = latestPlayer?.user?.profile?.first_name;
  const relativeJoinTime = formatRelativeTime(latestPlayerCreatedAt);

  const handlePress = () => {
    router.push(`/(app)/round/${id}` as any);
  };

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={handlePress}>
      <LinearGradient
        colors={["#2C2C2F", "#141518"]}
        style={styles.card}
      >
        <View style={[styles.leftAccent, { backgroundColor: status.color }]} />

        <View style={styles.topRow}>
          <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: status.color }]} />
            <Text style={[styles.statusText, { color: status.color }]}>
              {status.label}
            </Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceText}>{priceLabel ?? "—"}</Text>
            <Text style={styles.priceSuffix}> each</Text>
          </View>
        </View>

        <Text style={styles.courseName} numberOfLines={1}>
          {name?.trim() || courseName || "Course not set"}
        </Text>
        {name?.trim() && courseName ? (
          <Text style={styles.subtitleText} numberOfLines={1}>
            {courseName}
          </Text>
        ) : null}

        <View style={styles.dateRow}>
          <Text style={styles.dateText}>{formatDate(selectedDate)}</Text>
          <Text style={styles.timeSeparator}> · </Text>
          <Text style={styles.timeText}>{formatShortTime(exactTime, timeSlot)}</Text>
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.avatarsRow}>
            {Array.from({ length: playersNeeded }).map((_, i) => {
              const player = approvedPlayers[i];
              if (!player) {
                return <View key={`empty-${i}`} style={styles.avatarEmpty} />;
              }
              const palette = pickAvatarColor(player.user_id);
              const initial =
                player.user?.profile?.first_name?.[0]?.toUpperCase() ?? "?";
              const photo = player.user?.profile?.photo;
              return (
                <View
                  key={player.user_id}
                  style={[
                    styles.avatarFilled,
                    { backgroundColor: palette.bg, borderColor: palette.border },
                  ]}
                >
                  {photo ? (
                    <Image source={{ uri: photo }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarInitial}>{initial}</Text>
                  )}
                </View>
              );
            })}
            <Text style={styles.spotsLeftText}>
              {spotsLeft === 0
                ? "Full"
                : `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`}
            </Text>
          </View>

          <View style={styles.capacityDots}>
            {Array.from({ length: playersNeeded }).map((_, i) => (
              <View
                key={i}
                style={
                  i < approvedCount ? styles.capacityDotFilled : styles.capacityDotEmpty
                }
              />
            ))}
          </View>
        </View>

        {latestPlayerName && relativeJoinTime && (
          <View style={styles.activityRow}>
            <View style={styles.activityDot} />
            <Text style={styles.activityText}>
              {latestPlayerName} joined {relativeJoinTime}
            </Text>
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
};

const AVATAR_SIZE = 36;

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    overflow: "hidden",
    position: "relative",
  },
  leftAccent: {
    position: "absolute",
    left: 0,
    top: spacing.md,
    bottom: spacing.md,
    width: 3,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: borderRadius.round,
    gap: spacing.xs + 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: typography.fontSizes.xs,
    fontFamily: typography.fontFamily.semibold,
    letterSpacing: 0.5,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  priceText: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.lg,
    fontFamily: typography.fontFamily.semibold,
  },
  priceSuffix: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamily.regular,
  },
  courseName: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.xl,
    fontFamily: typography.fontFamily.semibold,
    marginBottom: spacing.xs,
  },
  subtitleText: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
    marginBottom: spacing.xs,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  dateText: {
    color: colors.primary.yellow,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.medium,
  },
  timeSeparator: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.md,
  },
  timeText: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  avatarsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flexShrink: 1,
  },
  avatarFilled: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginRight: -8,
  },
  avatarEmpty: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.text.disabled,
    marginRight: -8,
  },
  avatarImage: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarInitial: {
    color: colors.text.primary,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.fontSizes.sm,
  },
  spotsLeftText: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamily.regular,
    marginLeft: spacing.md,
  },
  capacityDots: {
    flexDirection: "row",
    gap: spacing.xs + 2,
  },
  capacityDotFilled: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary.yellow,
  },
  capacityDotEmpty: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.text.disabled,
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.md,
    gap: spacing.xs + 2,
  },
  activityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary.yellow,
  },
  activityText: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamily.regular,
  },
});

export default NearbyGameCard;
