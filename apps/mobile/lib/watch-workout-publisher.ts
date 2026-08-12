import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  buildCancelledWatchSnapshot,
  buildWatchSettingsSnapshot,
  makeWatchEnvelope,
  type WatchWorkoutSnapshot,
} from "@/lib/watch-workout-sync";
import { isWatchPaired, sendWorkoutState } from "@/modules/watch-bridge/src";
import { getWatchSettingsSnapshot } from "@/stores/watch-settings-store";
import type { WorkoutExercise } from "@/stores/workout-store";

export const WATCH_WORKOUT_REVISION_STORAGE_KEY = "watch-workout-revision";
export const WATCH_SETTINGS_REVISION_STORAGE_KEY = "watch-settings-revision";

let latestRevision = 0;
let latestSettingsRevision = 0;
let revisionsHydrated = false;
let revisionsHydration: Promise<void> | null = null;
let workoutAllocation: Promise<unknown> = Promise.resolve();
let settingsAllocation: Promise<unknown> = Promise.resolve();

function parseRevision(value: string | null): number {
  if (value === null) return 0;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
}

async function readRevisions(): Promise<void> {
  try {
    const [storedWorkout, storedSettings] = await Promise.all([
      AsyncStorage.getItem(WATCH_WORKOUT_REVISION_STORAGE_KEY),
      AsyncStorage.getItem(WATCH_SETTINGS_REVISION_STORAGE_KEY),
    ]);
    latestRevision = Math.max(latestRevision, parseRevision(storedWorkout));
    latestSettingsRevision = Math.max(
      latestSettingsRevision,
      parseRevision(storedSettings)
    );
  } catch {
    // A storage read failure must not expose values or block a fresh revision.
    console.warn("[watch-workout-publisher] revision hydration failed");
  }
}

export async function hydrateWatchRevisions(): Promise<void> {
  if (revisionsHydrated) return;
  revisionsHydration ??= readRevisions().finally(() => {
    revisionsHydrated = true;
  });
  await revisionsHydration;
}

async function persistRevision(key: string, revision: number): Promise<void> {
  try {
    await AsyncStorage.setItem(key, String(revision));
  } catch {
    console.warn("[watch-workout-publisher] revision persistence failed");
  }
}

function allocateNextRevision(domain: "workout" | "settings"): Promise<number> {
  const previous =
    domain === "workout" ? workoutAllocation : settingsAllocation;
  const next = previous.then(async () => {
    await hydrateWatchRevisions();
    const now = Date.now();
    if (domain === "workout") {
      latestRevision = Math.max(latestRevision + 1, now);
      await persistRevision(WATCH_WORKOUT_REVISION_STORAGE_KEY, latestRevision);
      return latestRevision;
    }
    latestSettingsRevision = Math.max(latestSettingsRevision + 1, now);
    await persistRevision(
      WATCH_SETTINGS_REVISION_STORAGE_KEY,
      latestSettingsRevision
    );
    return latestSettingsRevision;
  });
  if (domain === "workout") {
    workoutAllocation = next.catch(() => undefined);
  } else {
    settingsAllocation = next.catch(() => undefined);
  }
  return next;
}

export function allocateWatchSettingsRevision(): Promise<number> {
  return allocateNextRevision("settings");
}

export function currentWatchRevision(): number {
  return latestRevision;
}

export function nextWatchRevision(): number {
  latestRevision = Math.max(latestRevision + 1, Date.now());
  void persistRevision(WATCH_WORKOUT_REVISION_STORAGE_KEY, latestRevision);
  return latestRevision;
}

export function currentWatchSettingsRevision(): number {
  return latestSettingsRevision;
}

export function nextWatchSettingsRevision(): number {
  latestSettingsRevision = Math.max(latestSettingsRevision + 1, Date.now());
  void persistRevision(
    WATCH_SETTINGS_REVISION_STORAGE_KEY,
    latestSettingsRevision
  );
  return latestSettingsRevision;
}

/** Seed a settings high-water mark for the first workout context. */
export async function ensureWatchSettingsRevision(): Promise<number> {
  await hydrateWatchRevisions();
  if (latestSettingsRevision > 0) return latestSettingsRevision;
  return allocateNextRevision("settings");
}

export async function publishWatchSnapshot(
  snapshot: WatchWorkoutSnapshot
): Promise<boolean> {
  if (Platform.OS !== "ios" || !isWatchPaired()) return false;
  await hydrateWatchRevisions();
  const settingsRevision = await ensureWatchSettingsRevision();
  const settingsSnapshot = buildWatchSettingsSnapshot(
    getWatchSettingsSnapshot()
  );
  const revision = await allocateNextRevision("workout");
  await sendWorkoutState(
    makeWatchEnvelope(snapshot, revision, settingsSnapshot, settingsRevision)
  );
  return true;
}

export async function publishCancelledWorkoutToWatch(input: {
  workoutName: string;
  startedAtMs: number | null;
  exercises: WorkoutExercise[];
}): Promise<boolean> {
  if (!input.startedAtMs) return false;
  return publishWatchSnapshot(
    buildCancelledWatchSnapshot({
      workoutName: input.workoutName,
      startedAtMs: input.startedAtMs,
      exercises: input.exercises,
    })
  );
}
