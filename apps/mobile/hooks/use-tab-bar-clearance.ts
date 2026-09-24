import { Platform } from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Spacing } from "@/constants/theme";

const TAB_BAR_BASE_HEIGHT = Platform.select({ ios: 70, default: 80 });

export function useTabBarClearance(): number {
  const insets = useSafeAreaInsets();

  return insets.bottom + TAB_BAR_BASE_HEIGHT + Spacing.lg;
}
