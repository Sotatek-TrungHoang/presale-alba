import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "@/constants/theme";
import { useLocation } from "@/providers/LocationProvider";
import { searchLocations, Location } from "@/api/location";
import { useDebounce } from "@/hooks/useDebounce";

interface LocationFilterModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectLocation: (location: {
    name: string;
    latitude: number;
    longitude: number;
  }) => void;
  selectedLocation: {
    name: string;
    latitude: number;
    longitude: number;
  } | null;
}

export function LocationFilterModal({
  visible,
  onClose,
  onSelectLocation,
  selectedLocation,
}: LocationFilterModalProps) {
  const { currentLocation } = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Location[]>([]);
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  useEffect(() => {
    const fetchLocations = async () => {
      if (!debouncedSearchTerm.trim()) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const results = await searchLocations(debouncedSearchTerm);
        setSearchResults(results);
      } catch (error) {
        console.error("Error searching locations:", error);
      } finally {
        setIsSearching(false);
      }
    };

    fetchLocations();
  }, [debouncedSearchTerm]);

  const handleUseCurrentLocation = () => {
    if (currentLocation) {
      onSelectLocation({
        name: "My Location",
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
      });
      onClose();
    }
  };

  const handleSelectLocation = (location: Location) => {
    onSelectLocation({
      name: "Selected Area",
      latitude: location.latitude,
      longitude: location.longitude,
    });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>Select Location</Text>
          <View style={styles.closeButton} />
        </View>

        <View style={styles.content}>
          <TouchableOpacity
            style={styles.currentLocationButton}
            onPress={handleUseCurrentLocation}
          >
            <Ionicons name="location" size={20} color={colors.primary.yellow} />
            <Text style={styles.currentLocationText}>Use Current Location</Text>
          </TouchableOpacity>

          <View style={styles.searchContainer}>
            <Ionicons
              name="search"
              size={20}
              color={colors.text.secondary}
              style={styles.searchIcon}
            />
            <TextInput
              placeholder="Search location"
              placeholderTextColor={colors.text.secondary}
              style={styles.searchInput}
              value={searchTerm}
              onChangeText={setSearchTerm}
            />
          </View>

          {isSearching ? (
            <ActivityIndicator
              size="small"
              color={colors.primary.yellow}
              style={styles.loader}
            />
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={(item, index) =>
                `${item.latitude}-${item.longitude}-${index}`
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.resultItem}
                  onPress={() => handleSelectLocation(item)}
                >
                  <Ionicons
                    name="location-outline"
                    size={20}
                    color={colors.text.secondary}
                  />
                  <Text style={styles.resultText}>{item.description}</Text>
                </TouchableOpacity>
              )}
              style={styles.resultsList}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.black,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === "ios" ? spacing.xxl : spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.surface,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  title: {
    fontSize: typography.fontSizes.lg,
    fontFamily: typography.fontFamily.semibold,
    color: colors.text.primary,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  currentLocationButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.neutral.surface,
    borderRadius: spacing.xl,
    marginBottom: spacing.lg,
  },
  currentLocationText: {
    marginLeft: spacing.sm,
    color: colors.text.primary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.medium,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral.surface,
    borderRadius: spacing.xl,
    paddingHorizontal: spacing.md,
    height: 48,
    marginBottom: spacing.xl,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.text.primary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
  },
  loader: {
    marginTop: spacing.xl,
  },
  resultsList: {
    marginTop: spacing.md,
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.surface,
  },
  resultText: {
    marginLeft: spacing.sm,
    color: colors.text.primary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
  },
});
