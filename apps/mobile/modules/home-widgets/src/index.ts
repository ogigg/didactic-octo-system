import { Platform } from "react-native";

// Lazy-load the native module so Android and web never touch it.
let _native: {
  setSnapshot(json: string): Promise<void>;
  clearSnapshot(): Promise<void>;
  hasInstalledWidgets(): Promise<boolean>;
} | null = null;

function getNative() {
  if (!_native && Platform.OS === "ios") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requireNativeModule } = require("expo-modules-core");
    _native = requireNativeModule("HomeWidgets");
  }
  return _native;
}

/**
 * Store a serialized snapshot for the widget extension and reload its
 * timelines. Rejects when the shared App Group is unavailable.
 */
export async function setWidgetSnapshot(json: string): Promise<void> {
  await getNative()?.setSnapshot(json);
}

export async function clearWidgetSnapshot(): Promise<void> {
  await getNative()?.clearSnapshot();
}

/** Whether the user has placed at least one Sweaty widget. */
export async function hasInstalledHomeWidgets(): Promise<boolean> {
  return (await getNative()?.hasInstalledWidgets()) ?? false;
}
