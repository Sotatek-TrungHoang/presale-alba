import { View } from "react-native";
import {
  createMaterialTopTabNavigator,
  MaterialTopTabNavigationOptions,
  MaterialTopTabNavigationEventMap,
} from "@react-navigation/material-top-tabs";
import { withLayoutContext } from "expo-router";
import { ParamListBase, TabNavigationState } from "@react-navigation/native";
import { colors, typography } from "@/constants/theme";
const { Navigator } = createMaterialTopTabNavigator();

export const MaterialTopTabs = withLayoutContext<
  MaterialTopTabNavigationOptions,
  typeof Navigator,
  TabNavigationState<ParamListBase>,
  MaterialTopTabNavigationEventMap
>(Navigator);

export default function Layout() {
  return (
    <MaterialTopTabs
      screenOptions={{
        tabBarIndicatorStyle: {
          backgroundColor: colors.primary.orange,
        },
        tabBarLabelStyle: {
          fontFamily: typography.fontFamily.light,
          fontSize: typography.fontSizes.md,
          color: colors.text.primary,
        },
        tabBarStyle: {
          backgroundColor: colors.neutral.black,
        },
      }}
    >
      <MaterialTopTabs.Screen name="index" options={{ title: "Pending" }} />
      <MaterialTopTabs.Screen name="upcoming" options={{ title: "Upcoming" }} />
      <MaterialTopTabs.Screen
        name="completed"
        options={{ title: "Completed" }}
      />
    </MaterialTopTabs>
  );
}
