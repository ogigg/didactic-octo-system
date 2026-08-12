import { Platform } from "react-native";

import {
  buildWatchSettingsSnapshot,
  makeWatchSettingsEnvelope,
  type WatchSettingsSnapshot,
} from "@/lib/watch-workout-sync";
import {
  allocateWatchSettingsRevision,
  currentWatchSettingsRevision,
  ensureWatchSettingsRevision,
  hydrateWatchRevisions,
} from "@/lib/watch-workout-publisher";
import { isWatchPaired, sendWatchSettings } from "@/modules/watch-bridge/src";
import {
  getWatchSettingsSnapshot,
  useWatchSettingsStore,
} from "@/stores/watch-settings-store";

/**
 * Publish one settings-only message. The native implementation uses
 * transferUserInfo for durable delivery and sendMessage only as a latency
 * optimization; it never writes an application context.
 */
export async function publishWatchSettings(
  snapshot: Partial<WatchSettingsSnapshot> = getWatchSettingsSnapshot()
): Promise<boolean> {
  if (Platform.OS !== "ios" || !isWatchPaired()) return false;
  await hydrateWatchRevisions();
  const revision = await allocateWatchSettingsRevision();
  const envelope = makeWatchSettingsEnvelope(
    buildWatchSettingsSnapshot(snapshot),
    revision
  );
  await sendWatchSettings(envelope);
  return true;
}

/**
 * Coalesce synchronous switch/picker changes into one durable publication.
 * The last snapshot wins, while callers all receive the result of that flush.
 */
let queuedSnapshot: Partial<WatchSettingsSnapshot> | null = null;
let queuedWaiters: Array<{
  resolve: (value: boolean) => void;
  reject: (reason: unknown) => void;
}> = [];
let flushScheduled = false;

export function queueWatchSettingsPublication(
  snapshot: Partial<WatchSettingsSnapshot> = getWatchSettingsSnapshot()
): Promise<boolean> {
  queuedSnapshot = buildWatchSettingsSnapshot({
    ...(queuedSnapshot ?? {}),
    ...snapshot,
  });
  const promise = new Promise<boolean>((resolve, reject) => {
    queuedWaiters.push({ resolve, reject });
  });
  if (!flushScheduled) {
    flushScheduled = true;
    queueMicrotask(() => {
      void flushQueuedWatchSettings();
    });
  }
  return promise;
}

async function flushQueuedWatchSettings(): Promise<void> {
  flushScheduled = false;
  const snapshot = queuedSnapshot;
  queuedSnapshot = null;
  const waiters = queuedWaiters;
  queuedWaiters = [];
  if (snapshot === null) return;

  try {
    const result = await publishWatchSettings(snapshot);
    waiters.forEach(({ resolve }) => resolve(result));
  } catch (error) {
    waiters.forEach(({ reject }) => reject(error));
  }

  // A change can arrive while the previous transfer is awaiting native work.
  if (queuedSnapshot !== null && !flushScheduled) {
    flushScheduled = true;
    queueMicrotask(() => {
      void flushQueuedWatchSettings();
    });
  }
}

export { currentWatchSettingsRevision, ensureWatchSettingsRevision };

/** Exposed for integration tests and bridge diagnostics. */
export function currentSettingsSnapshot(): WatchSettingsSnapshot {
  return buildWatchSettingsSnapshot(useWatchSettingsStore.getState());
}
