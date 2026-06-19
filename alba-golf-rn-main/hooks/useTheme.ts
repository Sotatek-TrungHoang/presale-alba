import { theme } from "@/constants/theme";

/**
 * Hook to access theme values throughout the app
 * @returns The theme object with all theme values
 */
export function useTheme() {
  return theme;
}
