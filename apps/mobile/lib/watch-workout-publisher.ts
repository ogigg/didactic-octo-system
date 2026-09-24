import { Platform } from "react-native";

import {
  buildCancelledWatchSnapshot,
  makeWatchEnvelope,
  type WatchWorkoutSnapshot,
} from "@/lib/watch-workout-sync";
import { isWatchPaired, sendWorkoutState } from "@/modules/watch-bridge/src";
import type { WorkoutExercise } from "@/stores/workout-store";

let latestRevision = 0;
let publicationQueue = Promise.resolve();

export function currentWatchRevision(): number {
  return latestRevision;
}

export function nextWatchRevision(): number {
  latestRevision = Math.max(latestRevision + 1, Date.now());
  return latestRevision;
}

export async function publishWatchSnapshot(
  snapshot: WatchWorkoutSnapshot
): Promise<boolean> {
  if (Platform.OS !== "ios" || !isWatchPaired()) return false;
  const envelope = makeWatchEnvelope(snapshot, nextWatchRevision());
  const publication = publicationQueue.then(() => sendWorkoutState(envelope));
  publicationQueue = publication.catch(() => undefined);
  await publication;
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
