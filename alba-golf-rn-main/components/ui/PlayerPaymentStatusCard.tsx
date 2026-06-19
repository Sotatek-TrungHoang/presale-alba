import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, spacing, typography } from "@/constants/theme";
import { GameDetail } from "@/hooks/useGameDetail";

interface PlayerPaymentStatusCardProps {
  player: GameDetail["players"][0];
}

const PlayerPaymentStatusCard: React.FC<PlayerPaymentStatusCardProps> = ({
  player,
}) => {
  const profile = player.user.profile;
  const playerName = `${profile?.first_name || "Player"} ${
    profile?.last_name || ""
  }`.trim();
  const photoUri = profile?.photo;

  const hasPaid = player.has_paid === true; // Explicitly check for true
  const paymentStatusText = hasPaid
    ? "Payment received"
    : "Waiting for payment";
  const paymentStatusColor = hasPaid
    ? colors.semantic.success
    : colors.semantic.error;

  return (
    <LinearGradient
      colors={["#2C2C2F", "#141518"]}
      style={styles.gradientContainer}
    >
      <View style={styles.cardContent}>
        <View style={styles.playerInfoContainer}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder} />
          )}
          <View style={styles.playerTextContainer}>
            <Text style={styles.playerName}>{playerName}</Text>
            <Text style={[styles.paymentStatus, { color: paymentStatusColor }]}>
              {paymentStatusText}
            </Text>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradientContainer: {
    borderRadius: spacing.md,
    marginBottom: spacing.md,
    shadowColor: colors.neutral.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  cardContent: {
    paddingVertical: spacing.md, // Adjusted padding for a potentially slimmer card
    paddingHorizontal: spacing.md,
  },
  playerInfoContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: spacing.md,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.neutral.placeholder,
    marginRight: spacing.md,
  },
  playerTextContainer: {
    flex: 1,
    justifyContent: "center", // Center text vertically if avatar is taller
  },
  playerName: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.xl, // Consistent with JoinRequestCard
    fontFamily: typography.fontFamily.semibold,
    letterSpacing: -1,
    marginBottom: spacing.xxs, // Small space between name and status
  },
  paymentStatus: {
    fontSize: typography.fontSizes.md, // Slightly smaller than name
    fontFamily: typography.fontFamily.regular,
    // Color is set dynamically
  },
});

export default PlayerPaymentStatusCard;
