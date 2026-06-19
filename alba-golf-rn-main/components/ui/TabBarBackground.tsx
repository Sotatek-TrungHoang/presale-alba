import { View, StyleSheet } from "react-native";
import { colors } from "@/constants/theme";

export default function AndroidTabBarBackground() {
  return <View style={styles.background} />;
}

const styles = StyleSheet.create({
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.neutral.black,
  },
});

export function useBottomTabOverflow() {
  return 0;
}
