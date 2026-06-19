import { Redirect, Tabs } from "expo-router";
import React from "react";
import { Platform, TouchableOpacity, View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { HapticTab } from "@/components/HapticTab";
import { IconSymbol } from "@/components/ui/IconSymbol";
import TabBarBackground from "@/components/ui/TabBarBackground";
import { colors } from "@/constants/theme";
import { useRouter } from "expo-router";
import { useNotificationContext } from "@/providers/NotificationProvider";

function HeaderLeft() {
  const router = useRouter();
  return (
    <TouchableOpacity
      onPress={() => router.push("/menu" as any)}
      style={{ marginLeft: 16 }}
    >
      <Ionicons name="menu-outline" size={28} color={colors.text.primary} />
    </TouchableOpacity>
  );
}

function HeaderRight() {
  const router = useRouter();
  const { notifications } = useNotificationContext();

  // Calculate unread count
  const unreadCount = notifications.filter(
    (notification) => !notification.read
  ).length;

  return (
    <TouchableOpacity
      onPress={() => router.push("/notifications" as any)}
      style={{ marginRight: 16, position: "relative" }}
    >
      <Ionicons
        name="notifications-outline"
        size={24}
        color={colors.text.primary}
      />
      {unreadCount > 0 && (
        <View
          style={{
            position: "absolute",
            top: -6,
            right: -6,
            backgroundColor: colors.primary.red,
            borderRadius: 10,
            minWidth: 20,
            height: 20,
            justifyContent: "center",
            alignItems: "center",
            borderWidth: 2,
            borderColor: colors.neutral.black,
          }}
        >
          <Text
            style={{
              color: "white",
              fontSize: 12,
              fontWeight: "600",
              textAlign: "center",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.text.primary,
        tabBarInactiveTintColor: colors.text.secondary,
        headerShown: true,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            // Use a transparent background on iOS to show the blur effect
            position: "absolute",
          },
          android: {
            borderTopWidth: 0,
            elevation: 8,
          },
          default: {},
        }),
        headerStyle: {
          backgroundColor: colors.neutral.black,
        },
        headerShadowVisible: false,
        headerLeft: () => <HeaderLeft />,
        headerRight: () => <HeaderRight />,
        headerTitle: "",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="house" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="magnifyingglass" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="myRounds"
        options={{
          title: "My Rounds",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="figure.golf" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chats/index"
        options={{
          title: "Chats",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="ellipsis.bubble" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
