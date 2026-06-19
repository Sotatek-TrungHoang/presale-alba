import { colors } from "@/constants/theme";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View, StyleSheet } from "react-native";

type Props = {
  onPress: () => void;
  iconName?:
    | keyof typeof MaterialIcons.glyphMap
    | keyof typeof Ionicons.glyphMap;
  iconFamily?: "MaterialIcons" | "Ionicons";
  size?: number;
  width?: number;
  height?: number;
  color?: string;
  testID?: string;
};

export const CircleButton = ({
  onPress,
  iconName,
  iconFamily = "MaterialIcons",
  size = 38,
  width = 84,
  height = 84,
  color = colors.neutral.black,
  testID,
}: Props) => {
  let iconContent;

  if (iconFamily === "Ionicons") {
    const resolvedIconName = (iconName ||
      "add-outline") as keyof typeof Ionicons.glyphMap;
    iconContent = (
      <Ionicons name={resolvedIconName} size={size} color={color} />
    );
  } else {
    const resolvedIconName = (iconName ||
      "add") as keyof typeof MaterialIcons.glyphMap;
    iconContent = (
      <MaterialIcons name={resolvedIconName} size={size} color={color} />
    );
  }

  return (
    <View style={[styles.circleButtonContainer, { width, height }]}>
      <Pressable style={styles.circleButton} onPress={onPress} testID={testID}>
        {iconContent}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  circleButtonContainer: {
    width: 84,
    height: 84,
    borderRadius: 42,
    padding: 3,
  },
  circleButton: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 42,
    backgroundColor: colors.primary.orange,
    shadowColor: colors.neutral.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});
