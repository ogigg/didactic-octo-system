import { Platform } from "react-native";

import type { WatchSetCompletion, WatchWorkoutState } from "./types";

export type { WatchSetCompletion, WatchWorkoutState };

// Lazy-load native module to avoid crashing on Android / web
let _native: {
  sendWorkoutState(state: Record<string, unknown>): Promise<void>;
  sendWorkoutEnded(): Promise<void>;
  isWatchPaired(): boolean;
  isWatchReachable(): boolean;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
} | null = null;

let _emitter: {
  addListener(
    eventName: string,
    listener: (event: Record<string, unknown>) => void
  ): { remove(): void };
} | null = null;

function getNative() {
  if (!_native && Platform.OS === "ios") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requireNativeModule } = require("expo-modules-core");
    _native = requireNativeModule("WatchBridge");
  }
  return _native;
}

function getEmitter() {
  if (!_emitter && Platform.OS === "ios") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { EventEmitter, requireNativeModule } = require("expo-modules-core");
    const mod = requireNativeModule("WatchBridge");
    _emitter = new EventEmitter(mod);
  }
  return _emitter;
}

export async function sendWorkoutState(
  state: WatchWorkoutState
): Promise<void> {
  await getNative()?.sendWorkoutState(
    state as unknown as Record<string, unknown>
  );
}

export async function sendWorkoutEnded(): Promise<void> {
  await getNative()?.sendWorkoutEnded();
}

export function isWatchPaired(): boolean {
  return getNative()?.isWatchPaired() ?? false;
}

export function isWatchReachable(): boolean {
  return getNative()?.isWatchReachable() ?? false;
}

export function onSetCompleted(
  listener: (completion: WatchSetCompletion) => void
): { remove(): void } {
  const emitter = getEmitter();
  if (!emitter) return { remove: () => {} };
  return emitter.addListener("onSetCompleted", (event) => {
    listener(event as unknown as WatchSetCompletion);
  });
}
