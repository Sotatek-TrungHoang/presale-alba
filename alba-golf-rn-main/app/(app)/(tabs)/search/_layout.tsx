import React, { useState, useEffect, useRef } from "react";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import {
  TouchableOpacity,
  StyleSheet,
  Modal,
  View,
  Text,
  Pressable,
  Dimensions,
  Animated,
} from "react-native";
import { useAuth } from "@/hooks/useAuth";
import { colors } from "@/constants/theme";

const { width } = Dimensions.get("window");
const DRAWER_WIDTH = width * 0.75;
const NOTIFICATIONS_WIDTH = width * 0.85; // Width for notifications panel

export default function Layout() {
  const { logout } = useAuth();
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const [isNotificationsVisible, setIsNotificationsVisible] = useState(false); // State for notifications modal
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const notificationsSlideAnim = useRef(new Animated.Value(width)).current; // Animated value for notifications (start off-screen right)

  // Animate drawer opening
  useEffect(() => {
    if (isDrawerVisible) {
      // Close notifications if opening drawer
      if (isNotificationsVisible) closeNotifications();
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [isDrawerVisible]); // Dependency: only isDrawerVisible

  // Animate notifications opening
  useEffect(() => {
    if (isNotificationsVisible) {
      // Close drawer if opening notifications
      if (isDrawerVisible) closeDrawer();
      Animated.timing(notificationsSlideAnim, {
        toValue: width - NOTIFICATIONS_WIDTH, // Animate to its position on the right edge
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [isNotificationsVisible]); // Dependency: only isNotificationsVisible

  // Function to handle closing drawer animation and state update
  const closeDrawer = (callback?: () => void) => {
    // Added optional callback
    Animated.timing(slideAnim, {
      toValue: -DRAWER_WIDTH,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setIsDrawerVisible(false);
      if (callback) callback(); // Execute callback if provided
    });
  };

  // Function to handle closing notifications animation and state update
  const closeNotifications = (callback?: () => void) => {
    // Added optional callback
    Animated.timing(notificationsSlideAnim, {
      toValue: width, // Animate back off-screen right
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setIsNotificationsVisible(false);
      if (callback) callback(); // Execute callback if provided
    });
  };

  const handleLogout = async () => {
    try {
      await logout();
      // If the drawer is open when logging out, ensure it's closed instantly
      // This prevents visual glitches if the component unmounts mid-animation
      if (isDrawerVisible) {
        slideAnim.setValue(-DRAWER_WIDTH);
        setIsDrawerVisible(false);
      }
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // Updated toggle drawer function
  const toggleDrawer = () => {
    if (isDrawerVisible) {
      closeDrawer();
    } else {
      const action = () => {
        slideAnim.setValue(-DRAWER_WIDTH); // Ensure starting position
        setIsDrawerVisible(true); // Triggers useEffect for slide-in
      };
      // If notifications are visible, close them first, then open drawer
      if (isNotificationsVisible) {
        closeNotifications(action);
      } else {
        action();
      }
    }
  };

  // Toggle notifications function
  const toggleNotifications = () => {
    if (isNotificationsVisible) {
      closeNotifications();
    } else {
      const action = () => {
        notificationsSlideAnim.setValue(width); // Ensure starting position
        setIsNotificationsVisible(true); // Triggers useEffect for slide-in
      };
      // If drawer is visible, close it first, then open notifications
      if (isDrawerVisible) {
        closeDrawer(action);
      } else {
        action();
      }
    }
  };

  const handleActivatePaymentsPress = () => {
    closeDrawer(() => {
      router.push("/stripe-onboarding");
    });
  };

  const handleEditProfilePress = () => {
    closeDrawer(() => {
      router.push("/edit-profile");
    });
  };

  return (
    <>
      <Stack>
        <Stack.Screen
          name="(tabs)"
          options={{
            headerShown: false,
          }}
        />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  headerLeft: {
    marginLeft: 15,
  },
  // Added headerRight style
  headerRight: {
    marginRight: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    // Position panels absolutely within the overlay
    position: "relative",
  },
  // Common style for inner content pressable to prevent closing
  panelInnerContent: {
    flex: 1,
    paddingTop: 80, // Consistent padding from top
    paddingHorizontal: 20,
  },
  panelTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.text.primary,
    marginBottom: 20,
  },
  drawerContainer: {
    width: DRAWER_WIDTH,
    height: "100%",
    backgroundColor: colors.neutral.black,
    borderRightWidth: 1,
    borderColor: "#333",
    position: "absolute", // Position absolutely within overlay
    left: 0, // Align to left
    top: 0,
  },
  // Added notificationsContainer style
  notificationsContainer: {
    width: NOTIFICATIONS_WIDTH,
    height: "100%",
    backgroundColor: colors.neutral.black, // Same background for consistency
    borderLeftWidth: 1, // Border on the left now
    borderColor: "#333",
    position: "absolute", // Position absolutely within overlay
    left: 0, // Position based on transform, but initial left is 0
    top: 0,
  },
  drawerItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    marginBottom: 10,
  },
  drawerIcon: {
    marginRight: 15,
  },
  drawerText: {
    color: colors.text.primary,
    fontSize: 18,
  },
  // Added notification styles
  notificationItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#444", // Separator line
  },
  notificationIcon: {
    marginRight: 10,
  },
  notificationText: {
    color: colors.text.secondary ?? colors.text.primary, // Use secondary text color if available
    fontSize: 14,
    flexShrink: 1, // Allow text to wrap
  },
});
