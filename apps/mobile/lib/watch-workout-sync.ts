import { z } from "zod";

import {
  WATCH_SYNC_PROTOCOL_VERSION,
  type WatchActionEnvelope,
  type WatchActionPayload,
  type WatchSettingsEnvelope,
  type WatchSettingsSnapshot,
  type WatchSyncEnvelope,
} from "@/modules/watch-bridge/src";
import { sanitizeWatchSettings } from "@/stores/watch-settings-store";
import type {
  RestTimerState,
  WorkoutExercise,
  WorkoutSummary,
} from "@/stores/workout-store";
import { getExerciseOccurrenceId } from "@/stores/workout-store";

export type {
  WatchSettingsEnvelope,
  WatchSettingsSnapshot,
} from "@/modules/watch-bridge/src";

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
  catalogExerciseId: string;
  name: string;
  exerciseType: "weight" | "time";
  restDurationSeconds: number;
  notes: string | null;
  progressionType: string | null;
  sets: WatchSetSnapshot[];
}

export interface WatchRestSnapshot {
  id: string;
  exerciseId: string;
  durationSeconds: number;
  endDate: string | null;
  pausedRemainingSeconds: number | null;
}

export interface WatchWorkoutSnapshot {
  workoutId: string;
  name: string;
  status: "active" | "completed" | "cancelled";
  startedAt: string;
  finishedAt: string | null;
  selectedExerciseId: string | null;
  exercises: WatchExerciseSnapshot[];
  rest: WatchRestSnapshot | null;
}

/** Runtime contract for preferences crossing the JS/native boundary. */
export const watchSettingsSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  restWarningSeconds: z.union([
    z.literal(0),
    z.literal(5),
    z.literal(10),
    z.literal(15),
    z.literal(30),
  ]),
  restEndHapticsEnabled: z.boolean(),
  restAdjustmentSeconds: z.union([z.literal(10), z.literal(15), z.literal(30)]),
  autoShowRestTimer: z.boolean(),
  restCompletionBehavior: z.enum(["stayOnTimer", "openNextSet"]),
  setCompletionHapticsEnabled: z.boolean(),
  confirmSkipRest: z.boolean(),
  confirmEndWorkout: z.boolean(),
  showHeartRate: z.boolean(),
  showPreviousPerformance: z.boolean(),
});

const watchSettingsEnvelopeSchema = z.object({
  protocolVersion: z.literal(WATCH_SYNC_PROTOCOL_VERSION),
  kind: z.literal("watchSettings"),
  settingsRevision: z.number().int().positive(),
  sentAt: z.string().datetime(),
  payload: z.string().min(1),
});

export { watchSettingsEnvelopeSchema };

/**
 * Normalize settings independently so one malformed persisted/UI value does
 * not discard valid sibling preferences.
 */
export function buildWatchSettingsSnapshot(
  state: Partial<WatchSettingsSnapshot>
): WatchSettingsSnapshot {
  return sanitizeWatchSettings(state);
}

export function makeWatchSettingsEnvelope(
  snapshot: WatchSettingsSnapshot,
  settingsRevision: number
): WatchSettingsEnvelope {
  const safeSnapshot = watchSettingsSnapshotSchema.parse(
    buildWatchSettingsSnapshot(snapshot)
  );
  const safeRevision =
    Number.isSafeInteger(settingsRevision) && settingsRevision > 0
      ? settingsRevision
      : 1;
  const envelope: WatchSettingsEnvelope = {
    protocolVersion: WATCH_SYNC_PROTOCOL_VERSION,
    kind: "watchSettings",
    settingsRevision: safeRevision,
    sentAt: new Date().toISOString(),
    payload: JSON.stringify(safeSnapshot),
  };
  return watchSettingsEnvelopeSchema.parse(envelope);
}

export function parseWatchSettingsEnvelope(
  value: unknown
): { envelope: WatchSettingsEnvelope; snapshot: WatchSettingsSnapshot } | null {
  const result = watchSettingsEnvelopeSchema.safeParse(value);
  if (!result.success) return null;
  let decoded: unknown;
  try {
    decoded = JSON.parse(result.data.payload);
  } catch {
    return null;
  }
  const snapshot = watchSettingsSnapshotSchema.safeParse(decoded);
  if (!snapshot.success) return null;
  return { envelope: result.data, snapshot: snapshot.data };
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
  restId: z.string().min(1).optional(),
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
  const exercise =
    exercises.find((item) => item.sets.some((set) => !set.isCompleted)) ??
    exercises.at(-1);
  return exercise ? getExerciseOccurrenceId(exercise) : null;
}

function exerciseSnapshots(
  exercises: WorkoutExercise[],
  localizedNames?: ReadonlyMap<string, string>
): WatchExerciseSnapshot[] {
  return exercises.map((exercise) => ({
    id: getExerciseOccurrenceId(exercise),
    catalogExerciseId: exercise.id,
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
    id: restTimer.id ?? `legacy-rest-${restTimer.startedAtMs}`,
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
    (exercise) => getExerciseOccurrenceId(exercise) === input.selectedExerciseId
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

export function buildCancelledWatchSnapshot(input: {
  workoutName: string;
  startedAtMs: number;
  exercises: WorkoutExercise[];
  localizedNames?: ReadonlyMap<string, string>;
  cancelledAtMs?: number;
}): WatchWorkoutSnapshot {
  return {
    workoutId: `workout-${input.startedAtMs}`,
    name: input.workoutName,
    status: "cancelled",
    startedAt: new Date(input.startedAtMs).toISOString(),
    finishedAt: new Date(input.cancelledAtMs ?? Date.now()).toISOString(),
    selectedExerciseId: null,
    exercises: exerciseSnapshots(input.exercises, input.localizedNames),
    rest: null,
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
  revision: number,
  settingsSnapshot?: WatchSettingsSnapshot,
  settingsRevision?: number
): WatchSyncEnvelope {
  const sentAt = new Date().toISOString();
  const envelope: WatchSyncEnvelope = {
    protocolVersion: WATCH_SYNC_PROTOCOL_VERSION,
    messageId: `${snapshot.workoutId}-${revision}`,
    revision,
    sentAt,
    kind: snapshot.status === "active" ? "workoutState" : "workoutEnded",
    payload: JSON.stringify(snapshot),
    acknowledgedCommandIDs: [],
  };
  if (
    settingsSnapshot !== undefined &&
    Number.isSafeInteger(settingsRevision) &&
    (settingsRevision as number) > 0
  ) {
    envelope.settingsRevision = settingsRevision;
    envelope.watchSettingsPayload = JSON.stringify(
      watchSettingsSnapshotSchema.parse(
        buildWatchSettingsSnapshot(settingsSnapshot)
      )
    );
  }
  return envelope;
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

export interface WatchActionReconciliationContext {
  currentRevision: number;
  workoutId: string | null;
  isActive: boolean;
  exerciseExists: boolean;
  setState: "missing" | "incomplete" | "completed";
  restId: string | null;
  canReconcileStaleSetMutation?: boolean;
}

export function shouldApplyWatchAction(
  parsed: NonNullable<ReturnType<typeof parseWatchAction>>,
  context: WatchActionReconciliationContext
): boolean {
  const { envelope, payload } = parsed;
  if (
    !context.isActive ||
    payload.workoutId !== context.workoutId ||
    envelope.baseRevision > context.currentRevision
  ) {
    return false;
  }

  switch (envelope.type) {
    case "selectExercise":
      return context.exerciseExists;
    case "updateSet":
    case "completeSet":
      return (
        (envelope.baseRevision === context.currentRevision ||
          context.canReconcileStaleSetMutation === true) &&
        context.setState === "incomplete"
      );
    case "adjustRest":
    case "pauseRest":
    case "resumeRest":
    case "skipRest":
      return payload.restId !== undefined && payload.restId === context.restId;
    case "healthWorkoutStarted":
    case "finishWorkout":
      return true;
  }
}

export function registerWatchCommand(
  commandID: string,
  processedCommandIDs: Set<string>
): boolean {
  if (processedCommandIDs.has(commandID)) return false;
  processedCommandIDs.add(commandID);
  return true;
}
