import React from "react";
import { Text, TextProps } from "react-native";
import { colors, typography } from "@/constants/theme";

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
type HeadingWeight = "light" | "regular" | "medium" | "semibold" | "bold";

interface HeadingProps extends TextProps {
  level?: HeadingLevel;
  weight?: HeadingWeight;
  children: React.ReactNode;
}

export const Heading: React.FC<HeadingProps> = ({
  level = 2,
  weight = "bold",
  style,
  children,
  ...props
}) => {
  const getFontSize = () => {
    switch (level) {
      case 1:
        return typography.fontSizes.xxxl;
      case 2:
        return typography.fontSizes.xxl;
      case 3:
        return typography.fontSizes.xl;
      case 4:
        return typography.fontSizes.lg;
      case 5:
        return typography.fontSizes.md;
      case 6:
        return typography.fontSizes.sm;
      default:
        return typography.fontSizes.lg;
    }
  };

  const getFontFamily = () => {
    switch (weight) {
      case "light":
        return typography.fontFamily.light;
      case "regular":
        return typography.fontFamily.regular;
      case "medium":
        return typography.fontFamily.medium;
      case "semibold":
        return typography.fontFamily.semibold;
      case "bold":
        return typography.fontFamily.bold;
      default:
        return typography.fontFamily.bold;
    }
  };

  const getLetterSpacing = () => {
    const fontSize = getFontSize();
    return fontSize * -0.06;
  };

  const getAlignment = () => {
    switch (level) {
      case 1:
        return "center";
      case 2:
        return "center";
      default:
        return "left";
    }
  };

  return (
    <Text
      style={[
        {
          fontSize: getFontSize(),
          fontFamily: getFontFamily(),
          color: colors.text.primary,
          letterSpacing: getLetterSpacing(),
          textAlign: getAlignment(),
        },
        style,
      ]}
      {...props}
    >
      {children}
    </Text>
  );
};
