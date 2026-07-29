import { z } from "zod";

import {
  WATCH_SYNC_PROTOCOL_VERSION,
  type WatchActionEnvelope,
  type WatchActionPayload,
  type WatchSyncEnvelope,
} from "@/modules/watch-bridge/src";
import type {
  RestTimerState,
  WorkoutExercise,
  WorkoutSummary,
} from "@/stores/workout-store";

export interface WatchSetSnapshot {
  id: string;
  type: "warmup" | "working";
  targetLoadKg: number | null;
  targetReps: number | null;
  actualLoadKg: number | null;
  actualReps: number | null;
  durationSeconds: number | null;
  isCompleted: boolean;
  previousDisplay: string | null;
}

export interface WatchExerciseSnapshot {
  id: string;
  name: string;
  exerciseType: "weight" | "time";
  restDurationSeconds: number;
  notes: string | null;
  progressionType: string | null;
  sets: WatchSetSnapshot[];
}

export interface WatchRestSnapshot {
  exerciseId: string;
  durationSeconds: number;
  endDate: string | null;
  pausedRemainingSeconds: number | null;
}

export interface WatchWorkoutSnapshot {
  workoutId: string;
  name: string;
  status: "active" | "completed";
  startedAt: string;
  finishedAt: string | null;
  selectedExerciseId: string | null;
  exercises: WatchExerciseSnapshot[];
  rest: WatchRestSnapshot | null;
}

const actionEnvelopeSchema = z.object({
  protocolVersion: z.literal(WATCH_SYNC_PROTOCOL_VERSION),
  commandID: z.string().min(1),
  baseRevision: z.number().int().nonnegative(),
  sentAt: z.string().datetime(),
  type: z.enum([
    "selectExercise",
    "updateSet",
    "completeSet",
    "adjustRest",
    "pauseRest",
    "resumeRest",
    "skipRest",
    "healthWorkoutStarted",
    "finishWorkout",
  ]),
  payload: z.string(),
});

const actionPayloadSchema = z.object({
  workoutId: z.string().min(1).optional(),
  exerciseId: z.string().min(1).optional(),
  setId: z.string().min(1).optional(),
  loadKg: z.number().finite().min(0).max(1_500).optional(),
  reps: z.number().int().min(0).max(1_000).optional(),
  deltaSeconds: z.number().int().min(-600).max(600).optional(),
  completedAt: z.string().datetime().optional(),
  healthWorkoutUUID: z.string().uuid().optional(),
});

function numericValue(value: string): number | null {
  const parsed = Number(value);
  return value.trim() !== "" && Number.isFinite(parsed) ? parsed : null;
}

function firstIncompleteExerciseId(
  exercises: WorkoutExercise[]
): string | null {
  return (
    exercises.find((exercise) => exercise.sets.some((set) => !set.isCompleted))
      ?.id ??
    exercises.at(-1)?.id ??
    null
  );
}

function exerciseSnapshots(
  exercises: WorkoutExercise[],
  localizedNames?: ReadonlyMap<string, string>
): WatchExerciseSnapshot[] {
  return exercises.map((exercise) => ({
    id: exercise.id,
    name: localizedNames?.get(exercise.id) ?? exercise.name,
    exerciseType: exercise.exerciseType,
    restDurationSeconds: exercise.restDurationSeconds,
    notes: exercise.notes || null,
    progressionType: exercise.progressionType ?? null,
    sets: exercise.sets.map((set) => ({
      id: set.id,
      type: set.type,
      targetLoadKg: numericValue(set.kg),
      targetReps: numericValue(set.reps),
      actualLoadKg: numericValue(set.kg),
      actualReps: numericValue(set.reps),
      durationSeconds: set.durationSeconds,
      isCompleted: set.isCompleted,
      previousDisplay: set.previousDisplay,
    })),
  }));
}

function restSnapshot(
  restTimer: RestTimerState | null
): WatchRestSnapshot | null {
  if (!restTimer) return null;
  return {
    exerciseId: restTimer.exerciseId,
    durationSeconds: restTimer.durationSeconds,
    endDate:
      restTimer.pausedRemainingSeconds === undefined
        ? new Date(
            restTimer.startedAtMs + restTimer.durationSeconds * 1000
          ).toISOString()
        : null,
    pausedRemainingSeconds: restTimer.pausedRemainingSeconds ?? null,
  };
}

export function buildActiveWatchSnapshot(input: {
  workoutName: string;
  startedAtMs: number;
  exercises: WorkoutExercise[];
  restTimer: RestTimerState | null;
  selectedExerciseId?: string | null;
  localizedNames?: ReadonlyMap<string, string>;
}): WatchWorkoutSnapshot {
  const validSelection = input.exercises.some(
    (exercise) => exercise.id === input.selectedExerciseId
  );
  return {
    workoutId: `workout-${input.startedAtMs}`,
    name: input.workoutName,
    status: "active",
    startedAt: new Date(input.startedAtMs).toISOString(),
    finishedAt: null,
    selectedExerciseId: validSelection
      ? (input.selectedExerciseId ?? null)
      : firstIncompleteExerciseId(input.exercises),
    exercises: exerciseSnapshots(input.exercises, input.localizedNames),
    rest: restSnapshot(input.restTimer),
  };
}

export function buildCompletedWatchSnapshot(
  summary: WorkoutSummary,
  startedAtMs: number | null,
  localizedNames?: ReadonlyMap<string, string>
): WatchWorkoutSnapshot {
  const inferredStart = Math.max(
    0,
    startedAtMs ?? summary.finishedAtMs - summary.durationMs
  );
  return {
    workoutId: `workout-${inferredStart}`,
    name: summary.workoutName,
    status: "completed",
    startedAt: new Date(inferredStart).toISOString(),
    finishedAt: new Date(summary.finishedAtMs).toISOString(),
    selectedExerciseId: null,
    exercises: exerciseSnapshots(summary.exercises, localizedNames),
    rest: null,
  };
}

export function makeWatchEnvelope(
  snapshot: WatchWorkoutSnapshot,
  revision: number
): WatchSyncEnvelope {
  const sentAt = new Date().toISOString();
  return {
    protocolVersion: WATCH_SYNC_PROTOCOL_VERSION,
    messageId: `${snapshot.workoutId}-${revision}`,
    revision,
    sentAt,
    kind: snapshot.status === "active" ? "workoutState" : "workoutEnded",
    payload: JSON.stringify(snapshot),
    acknowledgedCommandIDs: [],
  };
}

export function parseWatchAction(
  value: unknown
): { envelope: WatchActionEnvelope; payload: WatchActionPayload } | null {
  const envelopeResult = actionEnvelopeSchema.safeParse(value);
  if (!envelopeResult.success) return null;
  let decoded: unknown;
  try {
    decoded = JSON.parse(envelopeResult.data.payload);
  } catch {
    return null;
  }
  const payloadResult = actionPayloadSchema.safeParse(decoded);
  if (!payloadResult.success) return null;
  return {
    envelope: envelopeResult.data,
    payload: payloadResult.data,
  };
}
