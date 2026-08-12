import { Platform } from "react-native";

import type {
  WatchActionEnvelope,
  WatchSettingsEnvelope,
  WatchSyncEnvelope,
} from "./types";

export type {
  WatchActionEnvelope,
  WatchActionPayload,
  WatchSettingsEnvelope,
  WatchSettingsSnapshot,
  WatchSyncEnvelope,
} from "./types";
export {
  WATCH_SYNC_PROTOCOL_VERSION,
  type RestAdjustmentSeconds,
  type RestCompletionBehavior,
  type RestWarningSeconds,
} from "./types";

interface NativeWatchBridge {
  sendWorkoutState(state: Record<string, unknown>): Promise<void>;
  sendWatchSettings(state: Record<string, unknown>): Promise<void>;
  drainPendingActions(): Promise<Record<string, unknown>[]>;
  acknowledgeCommand(commandID: string): Promise<void>;
  isWatchPaired(): boolean;
  isWatchAppInstalled(): boolean;
  isWatchReachable(): boolean;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

interface NativeEmitter {
  addListener(
    eventName: string,
    listener: (event: Record<string, unknown>) => void
  ): { remove(): void };
}

let nativeModule: NativeWatchBridge | null = null;
let nativeEmitter: NativeEmitter | null = null;

function getNative(): NativeWatchBridge | null {
  if (!nativeModule && Platform.OS === "ios") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requireNativeModule } = require("expo-modules-core");
    nativeModule = requireNativeModule("WatchBridge");
  }
  return nativeModule;
}

function getEmitter(): NativeEmitter | null {
  if (!nativeEmitter && Platform.OS === "ios") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { EventEmitter, requireNativeModule } = require("expo-modules-core");
    nativeEmitter = new EventEmitter(requireNativeModule("WatchBridge"));
  }
  return nativeEmitter;
}

export async function sendWorkoutState(
  envelope: WatchSyncEnvelope
): Promise<void> {
  await getNative()?.sendWorkoutState(
    envelope as unknown as Record<string, unknown>
  );
}

/**
 * Deliver settings through the durable user-info path. This deliberately has
 * a separate native method so settings can never become a second application
 * context writer.
 */
export async function sendWatchSettings(
  envelope: WatchSettingsEnvelope
): Promise<void> {
  await getNative()?.sendWatchSettings(
    envelope as unknown as Record<string, unknown>
  );
}

export interface WatchStatus {
  paired: boolean;
  installed: boolean;
  reachable: boolean;
}

/** Re-read the current synchronous WCSession flags for status screens. */
export async function refreshWatchStatus(): Promise<WatchStatus> {
  return {
    paired: isWatchPaired(),
    installed: isWatchAppInstalled(),
    reachable: isWatchReachable(),
  };
}

export function isWatchPaired(): boolean {
  return getNative()?.isWatchPaired() ?? false;
}

export function isWatchAppInstalled(): boolean {
  return getNative()?.isWatchAppInstalled() ?? false;
}

export function isWatchReachable(): boolean {
  return getNative()?.isWatchReachable() ?? false;
}

export function onWatchAction(
  listener: (action: WatchActionEnvelope) => void
): { remove(): void } {
  const emitter = getEmitter();
  if (!emitter) return { remove: () => {} };
  return emitter.addListener("onWatchAction", (event) => {
    listener(event as unknown as WatchActionEnvelope);
  });
}

export async function drainPendingWatchActions(): Promise<
  WatchActionEnvelope[]
> {
  const actions = await getNative()?.drainPendingActions();
  return (actions ?? []) as unknown as WatchActionEnvelope[];
}

export async function acknowledgeWatchCommand(
  commandID: string
): Promise<void> {
  await getNative()?.acknowledgeCommand(commandID);
}
