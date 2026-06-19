import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "@/constants/theme";
import { useAuth } from "@/providers/Auth";
import { router } from "expo-router";

export default function MenuScreen() {
  const { logout, deleteAccount } = useAuth();

  const handleLogout = async () => {
    try {
      // Navigate to welcome screen first, then logout
      router.replace("/welcome");

      // Add a small delay to ensure navigation completes
      setTimeout(async () => {
        await logout();
      }, 100);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const handleActivatePaymentsPress = () => {
    router.push("/stripe-onboarding");
  };

  const handleEditProfilePress = () => {
    router.push("/edit-profile");
  };

  const handleEditAvailabilityPress = () => {
    router.push("/edit-availability");
  };

  const handleModerationPress = () => {
    router.push("/moderation/dashboard");
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete account",
      "Are you sure you want to permanently delete your account? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAccount();
              router.replace("/welcome");
            } catch (error) {
              console.error("Delete account failed:", error);
              Alert.alert(
                "Error",
                "Unable to delete your account. Please try again later."
              );
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.menuList}>
        <View style={styles.menuGroup}>
          <TouchableOpacity
            onPress={handleEditProfilePress}
            style={styles.menuItem}
          >
            <Ionicons
              name="person-outline"
              size={24}
              color={colors.text.primary}
              style={styles.menuIcon}
            />
            <Text style={styles.menuText}>Edit profile</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            onPress={handleEditAvailabilityPress}
            style={styles.menuItem}
          >
            <Ionicons
              name="time-outline"
              size={24}
              color={colors.text.primary}
              style={styles.menuIcon}
            />
            <Text style={styles.menuText}>Edit availability</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            onPress={handleActivatePaymentsPress}
            style={styles.menuItem}
          >
            <Ionicons
              name="card-outline"
              size={24}
              color={colors.text.primary}
              style={styles.menuIcon}
            />
            <Text style={styles.menuText}>Activate payouts</Text>
          </TouchableOpacity>
          {/* <View style={styles.divider} /> */}
          {/* <TouchableOpacity
            onPress={handleModerationPress}
            style={styles.menuItem}
          >
            <Ionicons
              name="shield-outline"
              size={24}
              color={colors.text.primary}
              style={styles.menuIcon}
            />
            <Text style={styles.menuText}>Moderation Dashboard</Text>
          </TouchableOpacity> */}
        </View>

        <View style={styles.menuGroup}>
          <TouchableOpacity onPress={handleLogout} style={styles.menuItem}>
            <Ionicons
              name="log-out-outline"
              size={24}
              color={colors.text.primary}
              style={styles.menuIcon}
            />
            <Text style={styles.menuText}>Logout</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            onPress={handleDeleteAccount}
            style={styles.menuItem}
          >
            <Ionicons
              name="trash-outline"
              size={24}
              color={colors.text.primary}
              style={styles.menuIcon}
            />
            <Text style={styles.menuText}>Delete account</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.black,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  title: {
    color: colors.text.primary,
    fontSize: 28,
    fontWeight: "600",
    marginBottom: 32,
    textAlign: "center",
  },
  menuList: {
    flex: 1,
    justifyContent: "flex-start",
    padding: spacing.md,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 20,
  },
  menuIcon: {
    marginRight: 16,
  },
  menuText: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.md,
  },
  menuGroup: {
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.neutral.surface,
    borderRadius: spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: colors.neutral.black,
    marginVertical: spacing.xs,
  },
});
