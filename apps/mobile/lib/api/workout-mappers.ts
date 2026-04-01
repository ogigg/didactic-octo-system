import * as Crypto from "expo-crypto";

import type {
  WorkoutExercise,
  WorkoutSet,
  WorkoutSummary,
} from "@/stores/workout-store";

import type {
  CreateWorkoutSessionInput,
  SessionExerciseInput,
  SessionSetInput,
  SetLogInput,
  WorkoutDetail,
} from "./workouts";

// -----------------------------------------------------------------------------
// Store → DB Mapping
// -----------------------------------------------------------------------------

interface SessionSetWithLog {
  sessionSet: SessionSetInput;
  log: SetLogInput;
}

interface SessionExerciseWithSets {
  sessionExercise: SessionExerciseInput;
  sets: SessionSetWithLog[];
}

interface WorkoutDbPayload {
  session: CreateWorkoutSessionInput;
  exercises: SessionExerciseWithSets[];
}

interface MapToDbOptions {
  goalSnapshot: "build_strength" | "lose_weight" | "improve_fitness" | "custom";
  customGoalSnapshot?: string;
  generationSource?: "llm" | "fallback_template" | "fallback_substitution";
}

export function mapWorkoutStoreToDb(
  summary: WorkoutSummary,
  options: MapToDbOptions
): WorkoutDbPayload {
  const session: CreateWorkoutSessionInput = {
    name: summary.workoutName || null,
    generation_source: options.generationSource ?? "llm",
    goal_snapshot: options.goalSnapshot,
    custom_goal_snapshot: options.customGoalSnapshot,
    started_at: new Date(
      summary.finishedAtMs - summary.durationMs
    ).toISOString(),
  };

  const exercises = summary.exercises.map((exercise, index) => {
    const sessionExercise: SessionExerciseInput = {
      id: Crypto.randomUUID(),
      exercise_id: exercise.id,
      order_index: index,
      rest_duration_seconds: exercise.restDurationSeconds,
      notes: exercise.notes || undefined,
      difficulty_feedback: exercise.difficultyFeedback,
    };

    const sets = exercise.sets.map((set, setIndex) => {
      const sessionSet: SessionSetInput = {
        id: Crypto.randomUUID(),
        set_number: setIndex + 1,
        set_type: set.type,
        target_load_kg: parseLoadKg(set.kg),
        target_reps: parseReps(set.reps),
      };

      const log: SetLogInput = {
        actual_load_kg: set.isCompleted ? parseLoadKg(set.kg) : undefined,
        actual_reps: set.isCompleted ? parseReps(set.reps) : undefined,
        rpe: set.rpe ?? undefined,
        completed: set.isCompleted,
      };

      return { sessionSet, log };
    });

    return { sessionExercise, sets };
  });

  return { session, exercises };
}

// -----------------------------------------------------------------------------
// DB → Store Mapping
// -----------------------------------------------------------------------------

export function mapDbToWorkoutStore(detail: WorkoutDetail): {
  workoutName: string;
  exercises: WorkoutExercise[];
} {
  const exercises: WorkoutExercise[] = detail.exercises.map((ex) => ({
    id: ex.exercise_id,
    name: ex.exercise_name,
    restDurationSeconds: ex.rest_duration_seconds,
    notes: ex.notes ?? "",
    difficultyFeedback: ex.difficulty_feedback,
    sets: ex.sets.map((s) => mapDbSetToStore(s)),
  }));

  return {
    workoutName: detail.name ?? "",
    exercises,
  };
}

function mapDbSetToStore(
  dbSet: WorkoutDetail["exercises"][number]["sets"][number]
): WorkoutSet {
  const log = dbSet.log;
  return {
    id: dbSet.id,
    type: dbSet.set_type,
    kg:
      log?.actual_load_kg != null
        ? String(log.actual_load_kg)
        : String(dbSet.target_load_kg),
    reps:
      log?.actual_reps != null
        ? String(log.actual_reps)
        : String(dbSet.target_reps),
    rpe: log?.rpe ?? null,
    isCompleted: log?.completed ?? false,
    previousDisplay: null,
  };
}

// -----------------------------------------------------------------------------
// Parsing Helpers
// -----------------------------------------------------------------------------

function parseLoadKg(value: string): number {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function parseReps(value: string): number {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}
