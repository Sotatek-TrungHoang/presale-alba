import React from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { colors, typography, spacing } from "@/constants/theme";

type TabType = "about" | "availability";

interface UserTabNavigationProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export const UserTabNavigation: React.FC<UserTabNavigationProps> = ({
  activeTab,
  setActiveTab,
}) => (
  <View style={styles.tabContainer}>
    <TouchableOpacity
      style={[styles.tab, activeTab === "about" && styles.activeTab]}
      onPress={() => setActiveTab("about")}
    >
      <Text
        style={[styles.tabText, activeTab === "about" && styles.activeTabText]}
      >
        About
      </Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={[styles.tab, activeTab === "availability" && styles.activeTab]}
      onPress={() => setActiveTab("availability")}
    >
      <Text
        style={[
          styles.tabText,
          activeTab === "availability" && styles.activeTabText,
        ]}
      >
        Availability
      </Text>
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  tabContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.surfaceSecondary,
    marginHorizontal: spacing.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: {
    borderBottomColor: colors.primary.orange,
  },
  tabText: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
  },
  activeTabText: {
    color: colors.text.primary,
    fontFamily: typography.fontFamily.medium,
  },
});
