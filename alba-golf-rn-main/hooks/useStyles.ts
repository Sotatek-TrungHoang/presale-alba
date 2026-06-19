import { StyleSheet } from "react-native";
import { useTheme } from "./useTheme";

/**
 * Hook to create styles with access to theme values
 * Usage:
 * ```
 * const styles = useStyles(({ colors, spacing }) => ({
 *   container: {
 *     backgroundColor: colors.primary.main,
 *     padding: spacing.md,
 *   }
 * }));
 * ```
 */
export function useStyles<T extends StyleSheet.NamedStyles<T>>(
  styleCreator: (theme: ReturnType<typeof useTheme>) => T
): T {
  const theme = useTheme();
  return StyleSheet.create(styleCreator(theme));
}
