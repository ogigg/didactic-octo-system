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
  WorkoutWarmup,
} from "@/stores/workout-store";
import { getExerciseOccurrenceId } from "@/stores/workout-store";
import { toKg, type WeightUnit } from "@/lib/unit-conversion";

export interface WatchSetSnapshot {
  id: string;
  type: "warmup" | "working";
  targetLoadKg: number | null;
  targetReps: number | null;
  actualLoadKg: number | null;
  actualReps: number | null;
  targetDurationSeconds?: number | null;
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

export interface WatchWarmupSnapshot {
  durationSeconds: number;
  isCompleted: boolean;
}

export interface WatchWorkoutSnapshot {
  workoutId: string;
  name: string;
  status: "active" | "completed" | "cancelled";
  startedAt: string;
  finishedAt: string | null;
  selectedExerciseId: string | null;
  warmup?: WatchWarmupSnapshot | null;
  exercises: WatchExerciseSnapshot[];
  rest: WatchRestSnapshot | null;
  weightUnit?: WeightUnit;
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
    "requestState",
    "reopenSet",
    "healthWorkoutSaved",
    "healthWorkoutFailed",
    "setWarmupComplete",
  ]),
  payload: z.string(),
});

const actionPayloadSchema = z.object({
  workoutId: z.string().min(1).optional(),
  exerciseId: z.string().min(1).optional(),
  setId: z.string().min(1).optional(),
  loadKg: z.number().finite().min(0).max(1_500).optional(),
  reps: z.number().int().min(0).max(1_000).optional(),
  durationSeconds: z.number().finite().int().min(0).max(86_400).optional(),
  deltaSeconds: z.number().int().min(-600).max(600).optional(),
  restId: z.string().min(1).optional(),
  endDate: z.string().datetime().nullable().optional(),
  pausedRemainingSeconds: z
    .number()
    .finite()
    .min(0)
    .max(86_400)
    .nullable()
    .optional(),
  completedAt: z.string().datetime().optional(),
  finishedAt: z.string().datetime().optional(),
  isCompleted: z.boolean().optional(),
  healthWorkoutUUID: z.string().uuid().optional(),
});

function numericValue(value: string): number | null {
  const parsed = Number(value);
  return value.trim() !== "" && Number.isFinite(parsed) ? parsed : null;
}

function canonicalLoadKg(
  value: string | null | undefined,
  unit: WeightUnit
): number | null {
  const numeric = value == null ? null : numericValue(value);
  return numeric == null ? null : toKg(numeric, unit);
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
  localizedNames?: ReadonlyMap<string, string>,
  weightUnit: WeightUnit = "kg"
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
      targetLoadKg: canonicalLoadKg(set.plannedKg ?? set.kg, weightUnit),
      targetReps: numericValue(set.plannedReps ?? set.reps),
      actualLoadKg: canonicalLoadKg(set.kg, weightUnit),
      actualReps: numericValue(set.reps),
      targetDurationSeconds: set.plannedDurationSeconds ?? set.durationSeconds,
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
  warmup?: WorkoutWarmup | null;
  selectedExerciseId?: string | null;
  localizedNames?: ReadonlyMap<string, string>;
  weightUnit?: WeightUnit;
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
    warmup: input.warmup
      ? {
          durationSeconds: input.warmup.durationSeconds,
          isCompleted: input.warmup.isCompleted,
        }
      : null,
    exercises: exerciseSnapshots(
      input.exercises,
      input.localizedNames,
      input.weightUnit ?? "kg"
    ),
    rest: restSnapshot(input.restTimer),
    weightUnit: input.weightUnit ?? "kg",
  };
}

export function buildCancelledWatchSnapshot(input: {
  workoutName: string;
  startedAtMs: number;
  exercises: WorkoutExercise[];
  localizedNames?: ReadonlyMap<string, string>;
  cancelledAtMs?: number;
  weightUnit?: WeightUnit;
}): WatchWorkoutSnapshot {
  return {
    workoutId: `workout-${input.startedAtMs}`,
    name: input.workoutName,
    status: "cancelled",
    startedAt: new Date(input.startedAtMs).toISOString(),
    finishedAt: new Date(input.cancelledAtMs ?? Date.now()).toISOString(),
    selectedExerciseId: null,
    warmup: null,
    exercises: exerciseSnapshots(
      input.exercises,
      input.localizedNames,
      input.weightUnit ?? "kg"
    ),
    rest: null,
    weightUnit: input.weightUnit ?? "kg",
  };
}

export function buildCompletedWatchSnapshot(
  summary: WorkoutSummary,
  startedAtMs: number | null,
  localizedNames?: ReadonlyMap<string, string>,
  weightUnit?: WeightUnit
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
    warmup: summary.warmup
      ? {
          durationSeconds: summary.warmup.durationSeconds,
          isCompleted: summary.warmup.isCompleted,
        }
      : null,
    exercises: exerciseSnapshots(
      summary.exercises,
      localizedNames,
      weightUnit ?? summary.weightUnit ?? "kg"
    ),
    rest: null,
    weightUnit: weightUnit ?? summary.weightUnit ?? "kg",
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

export function extractWatchCommandID(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const commandID = (value as { commandID?: unknown }).commandID;
  return typeof commandID === "string" && commandID.length > 0
    ? commandID
    : null;
}

export interface WatchActionReconciliationContext {
  currentRevision: number;
  workoutId: string | null;
  isActive: boolean;
  exerciseExists: boolean;
  setState: "missing" | "incomplete" | "completed";
  restId: string | null;
  canApplyHealthCommand?: boolean;
}

export function shouldApplyWatchAction(
  parsed: NonNullable<ReturnType<typeof parseWatchAction>>,
  context: WatchActionReconciliationContext
): boolean {
  const { envelope, payload } = parsed;
  if (envelope.type === "requestState") return true;

  if (
    envelope.type === "healthWorkoutSaved" ||
    envelope.type === "healthWorkoutFailed"
  ) {
    return (
      payload.workoutId !== undefined &&
      (context.workoutId === payload.workoutId ||
        context.canApplyHealthCommand === true)
    );
  }

  if (!context.isActive || payload.workoutId !== context.workoutId) {
    return false;
  }

  switch (envelope.type) {
    case "selectExercise":
      return context.exerciseExists;
    case "updateSet":
    case "completeSet":
      return context.setState === "incomplete";
    case "reopenSet":
      return context.setState === "completed";
    case "setWarmupComplete":
      return true;
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
