import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";
import { useNotificationContext } from "@/providers/NotificationProvider";
import * as Notifications from "expo-notifications";

/**
 * Development-only component for testing notifications
 * Remove this from production builds
 */
export function NotificationTest() {
  const { expoPushToken, refreshNotifications } = useNotificationContext();

  console.log("expoPushToken", expoPushToken);

  const sendTestNotification = async () => {
    if (!expoPushToken) {
      Alert.alert(
        "No Token",
        "Push token not available. Make sure you're on a physical device."
      );
      return;
    }

    try {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: expoPushToken,
          title: "Test Notification",
          body: "This is a test notification from your app!",
          data: {
            type: "general",
            test: true,
          },
          sound: "default",
          priority: "high",
        }),
      });

      const result = await response.json();

      if (response.ok) {
        Alert.alert("Success", "Test notification sent! Check your device.");
        refreshNotifications();
      } else {
        Alert.alert(
          "Error",
          `Failed to send: ${result.errors?.[0]?.message || "Unknown error"}`
        );
      }
    } catch (error) {
      Alert.alert("Error", "Failed to send test notification");
      console.error("Test notification error:", error);
    }
  };

  const scheduleLocalNotification = async () => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Local Test",
          body: "This is a local notification scheduled for 5 seconds from now",
          data: { type: "general", local: true },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 5,
        },
      });

      Alert.alert(
        "Scheduled",
        "Local notification scheduled for 5 seconds from now"
      );
    } catch (error) {
      Alert.alert("Error", "Failed to schedule local notification");
      console.error("Local notification error:", error);
    }
  };

  const showTokenInfo = () => {
    Alert.alert("Push Token", expoPushToken || "No token available", [
      {
        text: "Copy",
        onPress: () => console.log("Token copied:", expoPushToken),
      },
      { text: "OK" },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notification Test</Text>

      <View style={styles.tokenContainer}>
        <Text style={styles.tokenLabel}>Push Token:</Text>
        <Text style={styles.tokenText} numberOfLines={2}>
          {expoPushToken
            ? `${expoPushToken.substring(0, 20)}...`
            : "Not available"}
        </Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={sendTestNotification}>
        <Ionicons name="send" size={20} color={colors.text.primary} />
        <Text style={styles.buttonText}>Send Test Push</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={scheduleLocalNotification}
      >
        <Ionicons name="time" size={20} color={colors.text.primary} />
        <Text style={styles.buttonText}>Schedule Local (5s)</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={showTokenInfo}>
        <Ionicons
          name="information-circle"
          size={20}
          color={colors.text.primary}
        />
        <Text style={styles.buttonText}>Show Full Token</Text>
      </TouchableOpacity>

      <Text style={styles.note}>
        Note: This component is for development testing only. Remove it before
        production.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.neutral.surface,
    padding: 16,
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary.yellow,
  },
  title: {
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    textAlign: "center",
  },
  tokenContainer: {
    marginBottom: 16,
  },
  tokenLabel: {
    color: colors.text.secondary,
    fontSize: 14,
    marginBottom: 4,
  },
  tokenText: {
    color: colors.text.primary,
    fontSize: 12,
    fontFamily: "monospace",
    backgroundColor: colors.neutral.black,
    padding: 8,
    borderRadius: 4,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary.yellow,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  buttonText: {
    color: colors.neutral.black,
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 8,
  },
  note: {
    color: colors.text.secondary,
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
    fontStyle: "italic",
  },
});
