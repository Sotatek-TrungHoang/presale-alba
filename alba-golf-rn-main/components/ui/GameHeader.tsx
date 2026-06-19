import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, spacing, typography } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import {
  formatTimeSlotDisplay,
  getGameTypeStyle,
  formatGeneralDisplayValue,
} from "@/utils/formatters";

// Match GamePlayer and UserWithProfile from [id].tsx for consistency
interface PlayerProfile {
  first_name?: string | null;
  photo?: string | null;
}

interface UserWithProfile {
  id: string;
  profile: PlayerProfile | null;
}

interface GamePlayer {
  user_id: string; // Or userId if your API client camelCases it
  user: UserWithProfile;
  status: string; // Added for filtering
}

interface PlayerSlotProps {
  player?: GamePlayer; // Pass the whole player object if available
  isOrganizerSlot?: boolean;
  organizerDisplayName?: string;
  isFilled?: boolean;
}

const PlayerSlot: React.FC<PlayerSlotProps> = ({
  player,
  isOrganizerSlot,
  organizerDisplayName,
  isFilled = false, // Default to false if no player object provided but slot is shown
}) => {
  const displayName =
    isOrganizerSlot && organizerDisplayName
      ? organizerDisplayName
      : player?.user?.profile?.first_name || "Player";
  const photoUri = player?.user?.profile?.photo;

  return (
    <View style={styles.playerSlotContainer}>
      {isFilled ? (
        photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.playerAvatarImage} />
        ) : (
          <View style={styles.playerAvatarFilled} /> // Fallback if photo is missing
        )
      ) : (
        <View style={styles.playerAvatarEmpty} />
      )}
      <Text style={isFilled ? styles.playerNameFilled : styles.playerNameEmpty}>
        {isFilled ? displayName : "Open"}
      </Text>
      {isOrganizerSlot && <Text style={styles.organizerText}>(organiser)</Text>}
    </View>
  );
};

interface GameHeaderProps {
  courseName: string;
  name?: string | null;
  date: string; // Pre-formatted date string
  gameFormat: string;
  gameType: string;
  timeSlot: string;
  onEditPress?: () => void;

  // New props based on backend data structure
  playersFromGame: GamePlayer[];
  creatorId: string;
  totalPlayersNeeded: number;
  isCurrentUserOrganizer: boolean; // For showing the edit button
  gameStatus?: string; // Current status of the game e.g. PLAYERS_REQUIRED, READY_TO_BOOK, READY
  exact_time?: string | null; // Optional: exact time if booked
}

export const GameHeader: React.FC<GameHeaderProps> = ({
  courseName,
  name,
  date,
  gameFormat,
  gameType,
  timeSlot,
  onEditPress,
  playersFromGame,
  creatorId,
  totalPlayersNeeded,
  isCurrentUserOrganizer,
  gameStatus,
  exact_time,
}) => {
  const { lozengeStyle, lozengeText } = getGameTypeStyle(gameType);

  // Filter for players who should visually fill a slot (e.g., APPROVED or CONFIRMED)
  const approvedPlayers = playersFromGame.filter(
    (p) => p.status === "APPROVED" || p.status === "CONFIRMED"
  );
  const currentPlayersCountForDisplay = approvedPlayers.length; // Count based on approved players

  // Find the organizer within the full playersFromGame array to get their details correctly
  const organizerPlayer = playersFromGame.find(
    (p) => p.user_id === creatorId || p.user.id === creatorId
  );
  const organizerDisplayName =
    organizerPlayer?.user?.profile?.first_name || "Organiser";

  // Check if game can be edited (only in certain statuses)
  const canEdit =
    isCurrentUserOrganizer &&
    (gameStatus === "PLAYERS_REQUIRED" || gameStatus === "READY_TO_BOOK");

  // Prepare players for display, ensuring organizer is first if approved
  let displayPlayers: GamePlayer[] = [];
  const organizerInApprovedList = approvedPlayers.find(
    (p) => p.user_id === creatorId || p.user.id === creatorId
  );

  if (organizerInApprovedList) {
    displayPlayers.push(organizerInApprovedList);
  }
  approvedPlayers.forEach((player) => {
    if (!displayPlayers.find((dp) => dp.user_id === player.user_id)) {
      displayPlayers.push(player);
    }
  });

  return (
    <LinearGradient
      colors={["#2C2C2F", colors.neutral.black]}
      style={styles.headerGradient}
    >
      <View style={styles.headerContent}>
        <View style={styles.titleRow}>
          <Text style={styles.courseName}>
            {name ? `${name} - ${courseName}` : courseName}
          </Text>
          {canEdit && (
            <TouchableOpacity style={styles.editButton} onPress={onEditPress}>
              <Ionicons
                name="pencil-outline"
                size={24}
                color={colors.text.primary}
              />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.dateFormatRow}>
          <Text style={styles.dateText}>{date}</Text>
          <Text style={styles.timeSlotText}>
            {formatGeneralDisplayValue(gameFormat)}
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
            <Text style={styles.detailText}>
              {currentPlayersCountForDisplay}/{totalPlayersNeeded} Players
            </Text>
          </View>
          <View style={styles.detailTextRight}>
            <Ionicons
              name="time-outline"
              size={14}
              color={colors.text.secondary}
            />
            <Text style={styles.detailText}>
              {exact_time ? exact_time : formatTimeSlotDisplay(timeSlot)}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.playerSlotsContainer}>
          {Array.from({ length: totalPlayersNeeded }).map((_, index) => {
            // Use the re-ordered displayPlayers list for displaying players in slots
            const playerForSlot = displayPlayers[index];
            const isOrganizerSlot =
              playerForSlot && // Check if playerForSlot exists before accessing its properties
              (playerForSlot.user_id === creatorId ||
                playerForSlot.user.id === creatorId);

            // A slot is considered filled if there's a display player at this index
            const isFilled = !!playerForSlot;

            return (
              <PlayerSlot
                key={index}
                player={playerForSlot} // Pass the (potentially undefined) display player
                isOrganizerSlot={isOrganizerSlot}
                organizerDisplayName={organizerDisplayName} // Still needed for the (organiser) text if player is organizer
                isFilled={isFilled}
              />
            );
          })}
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  headerGradient: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  headerContent: {},
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start", // align content to the top so the edit button stays in the corner when the title wraps
    marginBottom: spacing.xs,
  },
  editButton: {
    padding: spacing.sm,
    borderRadius: 10,
    backgroundColor: colors.neutral.surface,
    shadowColor: colors.neutral.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  courseName: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.xl,
    fontFamily: typography.fontFamily.semibold,
    flex: 1, // allow the title to take up remaining space without pushing the edit button off-screen
    flexShrink: 1, // enable the text to shrink/wrap instead of expanding horizontally
    flexWrap: "wrap",
    marginRight: spacing.sm, // add a bit of space between the title and the edit button
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
  detailTextRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  detailText: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.xs,
    fontFamily: typography.fontFamily.regular,
  },
  divider: {
    height: 1,
    backgroundColor: colors.text.secondary,
    marginVertical: spacing.xs,
  },
  playerSlotsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: spacing.sm,
  },
  playerSlotContainer: {
    alignItems: "center",
    width: 80,
  },
  playerAvatarFilled: {
    // Fallback if no image
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.neutral.surface,
    marginBottom: spacing.xs,
    justifyContent: "center",
    alignItems: "center",
  },
  playerAvatarImage: {
    // For actual avatar images
    width: 50,
    height: 50,
    borderRadius: 25,
    marginBottom: spacing.xs,
  },
  playerAvatarEmpty: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.text.disabled,
    marginBottom: spacing.xs,
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
  organizerText: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.xs,
    fontFamily: typography.fontFamily.regular,
    textAlign: "center",
    marginTop: 2, // Small spacing for the (organiser) text
  },
});
