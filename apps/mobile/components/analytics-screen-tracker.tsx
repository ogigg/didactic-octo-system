import { usePathname } from "expo-router";
import { useEffect } from "react";

import { trackScreenView } from "@/lib/track-event";

/**
 * Expo Router is backed by React Navigation 7, where PostHog's automatic
 * navigation integration cannot observe the container. Keep screen tracking
 * in this single route observer and let trackScreenView apply the allowlist.
 */
export function AnalyticsScreenTracker() {
  const pathname = usePathname();

  useEffect(() => {
    trackScreenView(pathname);
  }, [pathname]);

  return null;
}
