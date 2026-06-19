import { Platform } from "react-native";

// Define your color palette
export const colors = {
  // Primary colors
  primary: {
    yellow: "#FBB924",
    orange: "#F78222",
    red: "#E23642",
    pink: "#ffa4f6",
  },

  // Secondary colors
  secondary: {
    yellow: "#806000",
    orange: "#804500",
    red: "#802626",
  },

  tertiary: {
    yellow: "#57482d",
    orange: "#543c2c",
    red: "#4e2c30",
    pink: "#564457",
  },

  // Accent colors
  accent: {
    main: "#FF9500",
    light: "#FFB84D",
    dark: "#CC7600",
    contrast: "#FFFFFF",
  },

  // Semantic colors
  semantic: {
    success: "#34A853",
    warning: "#FBBC04",
    error: "#EA4335",
  },

  text: {
    primary: "#FFF7E0",
    secondary: "#959596",
    disabled: "#8E8E93",
  },

  // Neutral colors
  neutral: {
    white: "#FFF7E0",
    black: "#000000",
    background: "#F2F2F7",
    surface: "#2C2C2F",
    surfaceSecondary: "#959596",
    card: "#FFFFFF",
    text: "#000000",
    border: "#D1D1D6",
    placeholder: "#8E8E93",
  },

  // Grays
  gray: {
    50: "#F9F9F9",
    100: "#F2F2F7",
    200: "#E5E5EA",
    300: "#D1D1D6",
    400: "#C7C7CC",
    500: "#8E8E93",
    600: "#636366",
    700: "#48484A",
    800: "#3A3A3C",
    900: "#1C1C1E",
  },
};

// Define spacing
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 18,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// Define typography
export const typography = {
  fontFamily: {
    light: "Poppins-Light",
    regular: "Poppins-Regular",
    medium: "Poppins-Medium",
    semibold: "Poppins-SemiBold",
    bold: "Poppins-Bold",
  },
  fontSizes: {
    xs: Platform.OS === "ios" ? 12 : 10,
    sm: Platform.OS === "ios" ? 14 : 12,
    md: Platform.OS === "ios" ? 16 : 14,
    lg: Platform.OS === "ios" ? 20 : 18,
    xl: Platform.OS === "ios" ? 24 : 20,
    xxl: Platform.OS === "ios" ? 36 : 32,
    xxxl: Platform.OS === "ios" ? 40 : 36,
  },
  fontWeights: {
    light: "300",
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
  lineHeights: {
    tight: 1.2,
    normal: 1.5,
    loose: 1.8,
  },
};

// Define border radius
export const borderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  round: 9999,
};

// Shadow styles
export const shadows = {
  sm: {
    shadowColor: colors.neutral.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1.0,
    elevation: 1,
  },
  md: {
    shadowColor: colors.neutral.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  lg: {
    shadowColor: colors.neutral.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },
  xl: {
    shadowColor: colors.neutral.black,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
};

// Default theme
export const theme = {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
};

// Type definitions for theme
export type Theme = typeof theme;
export type ColorTheme = typeof colors;
export type SpacingTheme = typeof spacing;
export type TypographyTheme = typeof typography;
export type BorderRadiusTheme = typeof borderRadius;
export type ShadowsTheme = typeof shadows;
