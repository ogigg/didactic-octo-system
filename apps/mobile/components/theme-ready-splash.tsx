import type { ComponentProps } from "react";

import { AnimatedSplash } from "@/components/animated-splash";
import { useThemePreferenceStore } from "@/stores/theme-preference-store";

/**
 * Mounts the animated splash, which hides the native one, only once the saved
 * theme has been applied, so the app never flashes the system scheme on launch.
 */
export function ThemeReadySplash(props: ComponentProps<typeof AnimatedSplash>) {
  const themeHydrated = useThemePreferenceStore((s) => s.hasHydrated);
  return themeHydrated ? <AnimatedSplash {...props} /> : null;
}
