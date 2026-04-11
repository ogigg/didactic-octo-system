import AsyncStorage from "@react-native-async-storage/async-storage";

import type { HealthWorkoutPayload } from "./types";

const STORAGE_KEY = "@health-sync/retry-queue";

interface QueuedEntry {
  sessionId: string;
  startedAtMs: number;
  endedAtMs: number;
  type: HealthWorkoutPayload["type"];
}

async function readQueue(): Promise<QueuedEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is QueuedEntry =>
        typeof e === "object" &&
        e !== null &&
        typeof (e as QueuedEntry).sessionId === "string" &&
        typeof (e as QueuedEntry).startedAtMs === "number" &&
        typeof (e as QueuedEntry).endedAtMs === "number"
    );
  } catch {
    return [];
  }
}

async function writeQueue(entries: QueuedEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Best-effort — non-fatal
  }
}

export async function enqueueRetry(
  sessionId: string,
  payload: HealthWorkoutPayload
): Promise<void> {
  const entries = await readQueue();
  // De-dupe on sessionId
  const filtered = entries.filter((e) => e.sessionId !== sessionId);
  filtered.push({
    sessionId,
    startedAtMs: payload.startedAt.getTime(),
    endedAtMs: payload.endedAt.getTime(),
    type: payload.type,
  });
  await writeQueue(filtered);
}

export async function drainQueue(): Promise<
  { sessionId: string; payload: HealthWorkoutPayload }[]
> {
  const entries = await readQueue();
  // Drop everything from storage; callers decide what to do with failures.
  // Retry-once semantics: we don't loop forever on a broken entry.
  await writeQueue([]);
  return entries.map((e) => ({
    sessionId: e.sessionId,
    payload: {
      startedAt: new Date(e.startedAtMs),
      endedAt: new Date(e.endedAtMs),
      type: e.type,
    },
  }));
}
