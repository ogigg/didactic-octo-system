import { Platform } from "react-native";

import {
  useHasInstalledHomeWidgets,
  useHomeWidgets,
} from "@/hooks/use-home-widgets";

function HomeWidgetsPublisher() {
  useHomeWidgets();
  return null;
}

function InstalledHomeWidgetsGate() {
  const hasWidgets = useHasInstalledHomeWidgets();
  return hasWidgets ? <HomeWidgetsPublisher /> : null;
}

/**
 * Publishes the Home Screen and Lock Screen widget snapshot. Mounted at the
 * root inside QueryClientProvider so it keeps running across route changes.
 * Widgets exist only on iOS, and the publisher (with its queries) only runs
 * while the user has at least one widget placed.
 */
export function HomeWidgetsHost() {
  return Platform.OS === "ios" ? <InstalledHomeWidgetsGate /> : null;
}
