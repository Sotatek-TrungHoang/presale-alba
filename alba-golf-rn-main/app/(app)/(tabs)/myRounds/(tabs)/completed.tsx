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

export default function CompletedGamesScreen() {
  const { games, isLoading, error, refreshing, onRefresh } =
    useMyGames("completed");

  if (isLoading && !refreshing) {
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
    return (
      <View
        style={[styles.centered, { backgroundColor: colors.neutral.black }]}
      >
        <Text style={{ color: colors.text.secondary }}>
          No completed rounds found.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.neutral.black }}>
      <FlatList
        data={games}
        keyExtractor={(item) => item.id!}
        renderItem={({ item }) => <GameListing {...item} reviewCard={false} />}
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
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 100,
  },
});
