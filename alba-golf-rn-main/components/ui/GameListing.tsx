import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, spacing, typography } from "@/constants/theme";
import { useProfileStore } from "@/stores/profileStore"; // For creator's name
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  formatGeneralDisplayValue,
  formatDate,
  formatTimeSlotDisplay,
  getGameTypeStyle,
} from "@/utils/formatters";

// Define player types, similar to GameHeader and [id].tsx
interface GamePlayerUserProfile {
  first_name?: string | null;
  photo?: string | null; // Photo might be used in PlayerSlot if desired
}

interface GamePlayerUser {
  id: string;
  profile: GamePlayerUserProfile | null;
}

interface GamePlayer {
  user_id: string;
  user: GamePlayerUser;
  status: string;
}

interface PlayerSlotProps {
  filled: boolean;
  name?: string;
  isOrganizer?: boolean; // To potentially style or label the organizer
  photoUri?: string | null; // If we want to show avatars in GameListing slots
}

const PlayerSlot: React.FC<PlayerSlotProps> = ({
  filled,
  name,
  isOrganizer,
  photoUri,
}) => {
  // Basic avatar display, can be enhanced later
  const avatarContent = photoUri ? (
    <Image source={{ uri: photoUri }} style={styles.playerAvatarImage} />
  ) : (
    <View style={styles.playerAvatarFilled} />
  );

  return (
    <View style={styles.playerSlotContainer}>
      {filled ? avatarContent : <View style={styles.playerAvatarEmpty} />}
      <Text style={filled ? styles.playerNameFilled : styles.playerNameEmpty}>
        {filled ? name || "Player" : "Open"}
      </Text>
      {/* {isOrganizer && filled && <Text style={styles.organizerText}>(organiser)</Text>} */}
      {/* Organizer text can be added if design requires it for GameListing */}
    </View>
  );
};

interface GameListingProps {
  id: string | null;
  name?: string | null;
  playersNeeded: number | null; // This is total slots for the game
  timeSlot: string | null;
  gameType: string | null;
  gameFormat: string | null;
  courseName: string | null;
  courseId: string | null;
  selectedDate: number | null; // Timestamp
  reviewCard: boolean;
  playersInGame: GamePlayer[]; // Array of all players with their status
  creatorId: string; // ID of the game creator
  exact_time?: string | null; // Optional: exact time if booked
}

export const GameListing: React.FC<GameListingProps> = ({
  id,
  name,
  playersNeeded,
  timeSlot,
  gameType,
  gameFormat,
  courseName,
  courseId,
  reviewCard,
  selectedDate,
  playersInGame,
  creatorId,
  exact_time,
}) => {
  const { profile } = useProfileStore(); // For current user context if needed, not directly for slots now

  const handlePress = () => {
    if (reviewCard) return;
    router.push(`/(app)/round/${id}` as any);
  };

  // Filter for approved players
  const approvedPlayers = playersInGame
    ? playersInGame.filter(
        (p) => p.status === "APPROVED" || p.status === "CONFIRMED"
      )
    : [];
  const approvedPlayersCount = approvedPlayers.length;

  const renderPlayerSlots = () => {
    if (!playersNeeded) return null;
    const slots = [];
    for (let i = 0; i < playersNeeded; i++) {
      const playerForSlot = approvedPlayers[i];
      const isFilled = !!playerForSlot;
      const name =
        playerForSlot?.user?.profile?.first_name ||
        (profile?.id === playerForSlot?.user_id
          ? profile?.first_name || "You"
          : undefined);
      const isOrganizer = playerForSlot?.user_id === creatorId;
      const photo = playerForSlot?.user?.profile?.photo;

      slots.push(
        <PlayerSlot
          key={i}
          filled={isFilled}
          name={name}
          isOrganizer={isOrganizer}
          photoUri={photo}
        />
      );
    }
    return <View style={styles.playerSlotsWrapper}>{slots}</View>;
  };

  const formatGameFormat = (gameFormat: string | null) => {
    if (!gameFormat || gameFormat === "DONT_KNOW_YET") return "Game Format not set";
    return gameFormat.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const formattedGameFormat = formatGameFormat(gameFormat);



  const { lozengeStyle, lozengeText } = getGameTypeStyle(gameType);

  return (
    <TouchableOpacity onPress={handlePress} disabled={reviewCard}>
      <LinearGradient
        colors={["#2C2C2F", "#141518"]}
        style={styles.gradientContainer}
      >
        <Text style={styles.courseName}>
          {name
            ? `${name} - ${courseName || "Course not selected"}`
            : courseName || "Course not selected"}
        </Text>

        <View style={styles.dateFormatRow}>
          <Text style={styles.dateText}>{formatDate(selectedDate)}</Text>
          <Text style={styles.timeSlotText}>
            {formattedGameFormat}
          </Text>
        </View>

        <View style={[styles.lozengeBase, lozengeStyle]}>
          <Text style={styles.lozengeText}>{lozengeText}</Text>
        </View>

        <View style={styles.detailsRow}>
          <View style={styles.detailTextLeft}>
            <Ionicons
              name="person-outline"
              size={14}
              color={colors.text.secondary}
            />
            <Text style={styles.detailPlayersNeeded}>
              {playersNeeded
                ? `${reviewCard ? 1 : approvedPlayersCount}/${playersNeeded} Players`
                : "Players not set"}
            </Text>
          </View>
          <View style={styles.detailTextRight}>
            <Ionicons
              name="time-outline"
              size={14}
              color={colors.text.secondary}
            />
            <Text style={styles.detailTimeslot}>
              {exact_time ? exact_time : formatTimeSlotDisplay(timeSlot)}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {renderPlayerSlots()}
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  gradientContainer: {
    borderRadius: spacing.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  courseName: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.xl,
    fontFamily: typography.fontFamily.semibold,
    marginBottom: spacing.xs,
  },
  courseAddress: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamily.regular,
    marginBottom: spacing.xs,
  },
  dateFormatRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  dateText: {
    color: colors.primary.yellow,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.medium,
  },
  timeSlotText: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
  },
  lozengeBase: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    borderWidth: 1,
  },
  lozengeText: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.sm, 
    fontFamily: typography.fontFamily.medium,
  },
  detailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  detailTextLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  detailPlayersNeeded: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.xs,
    fontFamily: typography.fontFamily.regular,
  },
  detailTextRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  detailTimeslot: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.xs,
    fontFamily: typography.fontFamily.regular,
  },
  divider: {
    height: 1,
    backgroundColor: colors.text.secondary,
    marginVertical: spacing.xs,
  },
  playerSlotsWrapper: {
    flexDirection: "row",
    justifyContent: "space-around", // Or 'flex-start' with gap if preferred
    marginTop: spacing.sm,
  },
  playerSlotContainer: {
    alignItems: "center",
    width: 70, // Adjusted width a bit for more names
  },
  playerAvatarFilled: {
    width: 40, // Slightly smaller avatars for GameListing
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutral.surface,
    marginBottom: spacing.xs / 2,
  },
  playerAvatarImage: {
    // For actual avatar images
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: spacing.xs / 2,
  },
  playerAvatarEmpty: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.text.disabled,
    marginBottom: spacing.xs / 2,
  },
  playerNameFilled: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.xs,
    fontFamily: typography.fontFamily.medium,
    textAlign: "center",
  },
  playerNameEmpty: {
    color: colors.text.disabled,
    fontSize: typography.fontSizes.xs,
    fontFamily: typography.fontFamily.regular,
    textAlign: "center",
  },
  // organizerText: { // Style for (organiser) if added later
  //   color: colors.text.secondary,
  //   fontSize: typography.fontSizes.xxs - 1, // Even smaller
  //   fontFamily: typography.fontFamily.regular,
  //   textAlign: "center",
  // },
});

export default GameListing;
