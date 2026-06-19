import React from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from "react-native";
import GameListing from "@/components/ui/GameListing";
import { useMyGames } from "@/hooks/useMyGames";
import { colors } from "@/constants/theme";

export default function PendingGamesScreen() {
  const { games, isLoading, error, refreshing, onRefresh } =
    useMyGames("pending");

  if (isLoading && !refreshing) {
    // Show loading indicator only on initial load
    return (
      <View
        style={[styles.centered, { backgroundColor: colors.neutral.black }]}
      >
        <ActivityIndicator size="small" />
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={[styles.centered, { backgroundColor: colors.neutral.black }]}
      >
        <Text style={{ color: colors.text.secondary }}>{error}</Text>
      </View>
    );
  }

  if (games.length === 0 && !isLoading) {
    // Ensure isLoading is false before showing no games
    return (
      <View
        style={[styles.centered, { backgroundColor: colors.neutral.black }]}
      >
        <Text style={{ color: colors.text.secondary }}>
          No pending rounds found.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.neutral.black }}>
      <FlatList
        data={games}
        keyExtractor={(item) => item.id!}
        renderItem={({ item }) => (
          <GameListing
            {...item}
            reviewCard={false} // reviewCard is false for these listings
          />
        )}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  listContainer: {
    paddingHorizontal: 10, // Add horizontal padding for the list itself
    paddingTop: 10,
    paddingBottom: 100,
  },
});
