import { useEffect, useState } from "react";
import { useColorScheme as useRNColorScheme } from "react-native";

import { useThemePreferenceStore } from "@/stores/theme-preference-store";

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const colorScheme = useRNColorScheme();
  // react-native-web can't override the scheme, so apply the saved choice here.
  const preference = useThemePreferenceStore((s) => s.preference);

  if (hasHydrated) {
    return preference === "system" ? colorScheme : preference;
  }

  return "light";
}
