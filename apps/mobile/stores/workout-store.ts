import type { ExerciseImageData } from "@/lib/exercise-media";
import {
  buildExerciseSets,
  countWorkingSets,
  makeEmptyWorkingSet,
  normalizeSetsForExerciseType,
} from "@/lib/exercise-set-structure";
import type { ExercisePreviousSets } from "@/lib/workout-previous-sets";
import * as Crypto from "expo-crypto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import {
  createJSONStorage,
  persist,
  subscribeWithSelector,
} from "zustand/middleware";
import { trackEvent } from "@/lib/track-event";

export interface WorkoutSet {
  id: string;
  type: "warmup" | "working";
  kg: string;
  reps: string;
  durationSeconds: number | null;
  rpe: number | null;
  isCompleted: boolean;
  previousDisplay: string | null;
}

export interface WorkoutExerciseReasoning {
  muscle_groups: string;
  exercise_selection: string;
}

export interface WorkoutReasoning {
  muscle_groups: string;
  training_strategy: string;
}
export interface WorkoutWarmup {
  durationSeconds: number;
  isCompleted: boolean;
}

export interface WorkoutExercise {
  id: string;
  occurrenceId?: string;
  name: string;
  image?: ExerciseImageData;
  exerciseType: "weight" | "time";
  restDurationSeconds: number;
  notes: string;
  reasoning?: WorkoutExerciseReasoning | null;
  difficultyFeedback: "too_easy" | "ok" | "too_hard" | null;
  sets: WorkoutSet[];
  progressionType?:
    | "weight_up"
    | "reps_up"
    | "maintained"
    | "new_exercise"
    | null;
}

export interface RestTimerState {
  id?: string;
  exerciseId: string;
  startedAtMs: number;
  durationSeconds: number;
  pausedRemainingSeconds?: number;
}

export interface GenerationMeta {
  generationSource: "llm" | "fallback_template" | "fallback_substitution";
  goalSnapshot: "build_strength" | "lose_weight" | "improve_fitness" | "custom";
  customGoalSnapshot: string | null;
  reasoning?: WorkoutReasoning | null;
}

export type WorkoutSource = "queued_ai" | "manual" | "template" | "comeback";

export interface WorkoutStartOptions {
  workoutSource?: WorkoutSource;
  workoutId?: string | null;
  wasEdited?: boolean;
  editCount?: number;
}

interface WorkoutState {
  isActive: boolean;
  workoutName: string;
  warmup: WorkoutWarmup | null;
  exercises: WorkoutExercise[];
  startedAtMs: number | null;
  restTimer: RestTimerState | null;
  completedWorkoutSummary: WorkoutSummary | null;
  generationMeta: GenerationMeta | null;
  workoutSessionId: string | null;
  workoutSource: WorkoutSource | null;
  workoutId: string | null;
  workoutWasEdited: boolean;
  workoutEditCount: number;
  firstSetLogged: boolean;
  progressReached50: boolean;
  watchSelectedExerciseId: string | null;
  healthWorkoutOwnedByWatch: boolean;
}

export interface WorkoutSummary {
  workoutName: string;
  warmup: WorkoutWarmup | null;
  durationMs: number;
  exercises: WorkoutExercise[];
  finishedAtMs: number;
  healthWorkoutRecordedOnWatch?: boolean;
  healthWorkoutUUID?: string;
  workoutSessionId?: string | null;
  workoutSource?: WorkoutSource | null;
  workoutId?: string | null;
  generationSource?: GenerationMeta["generationSource"] | null;
  wasEdited?: boolean;
  editCount?: number;
}

interface WorkoutActions {
  startWorkout: (
    name: string,
    exercises: WorkoutExercise[],
    generationMeta?: GenerationMeta,
    warmup?: WorkoutWarmup | null,
    options?: WorkoutStartOptions
  ) => void;
  finishWorkout: (healthWorkoutUUID?: string) => void;
  setWatchSelectedExercise: (exerciseId: string | null) => void;
  markHealthWorkoutOwnedByWatch: () => void;
  clearWorkout: (options?: { suppressAbandonment?: boolean }) => void;
  toggleSetComplete: (exerciseId: string, setId: string) => void;
  updateSetField: (
    exerciseId: string,
    setId: string,
    field: "kg" | "reps",
    value: string
  ) => void;
  updateSetDuration: (
    exerciseId: string,
    setId: string,
    durationSeconds: number | null
  ) => void;
  updateSetRpe: (exerciseId: string, setId: string, rpe: number | null) => void;
  toggleWarmupComplete: () => void;
  addSet: (exerciseId: string) => void;
  removeSet: (exerciseId: string, setId: string) => void;
  updateNotes: (exerciseId: string, notes: string) => void;
  setExerciseDifficultyFeedback: (
    exerciseId: string,
    feedback: "too_easy" | "ok" | "too_hard" | null
  ) => void;
  replaceExercise: (
    exerciseId: string,
    newExercise: {
      id: string;
      name: string;
      image?: ExerciseImageData;
      exerciseType?: "weight" | "time";
    },
    previous?: ExercisePreviousSets
  ) => void;
  startRestTimer: (exerciseId: string) => void;
  adjustRestTimer: (deltaSeconds: number) => void;
  pauseRestTimer: () => void;
  resumeRestTimer: () => void;
  skipRestTimer: () => void;
  addExercise: (exercise: {
    id: string;
    name: string;
    image?: ExerciseImageData;
    exerciseType?: "weight" | "time";
    previous?: ExercisePreviousSets;
    reasoning?: WorkoutExerciseReasoning | null;
  }) => void;
  addExerciseAfter: (
    afterExerciseId: string,
    exercise: {
      id: string;
      name: string;
      image?: ExerciseImageData;
      exerciseType?: "weight" | "time";
      previous?: ExercisePreviousSets;
      reasoning?: WorkoutExerciseReasoning | null;
    }
  ) => void;
  reorderExercise: (exerciseId: string, targetIndex: number) => void;
  removeExercise: (exerciseId: string) => void;
  updateWorkoutName: (name: string) => void;
}

const initialState: WorkoutState = {
  isActive: false,
  workoutName: "",
  warmup: null,
  exercises: [],
  startedAtMs: null,
  restTimer: null,
  completedWorkoutSummary: null,
  generationMeta: null,
  workoutSessionId: null,
  workoutSource: null,
  workoutId: null,
  workoutWasEdited: false,
  workoutEditCount: 0,
  firstSetLogged: false,
  progressReached50: false,
  watchSelectedExerciseId: null,
  healthWorkoutOwnedByWatch: false,
};

let setCounter = 0;
let occurrenceCounter = 0;

function generateSetId(): string {
  setCounter += 1;
  return `set-${Date.now()}-${setCounter}`;
}

function generateOccurrenceId(): string {
  occurrenceCounter += 1;
  return `exercise-occurrence-${Date.now()}-${occurrenceCounter}`;
}

function generateRestTimerId(): string {
  return `rest-${Date.now()}-${generateSetId()}`;
}

function generateWorkoutSessionId(): string {
  const generated = Crypto.randomUUID?.();
  return (
    generated ||
    `workout-session-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

function hasLoggedSetData(workoutSet: WorkoutSet): boolean {
  // Planned load/reps/duration are already populated for generated workouts;
  // only completion or an explicit RPE indicates user-logged set data.
  return workoutSet.isCompleted || workoutSet.rpe !== null;
}

function getWorkoutMetrics(state: WorkoutState): {
  completedSets: number;
  plannedSets: number;
  completionRate: number;
  durationSeconds: number;
} {
  const plannedSets = state.exercises.reduce(
    (total, exercise) => total + exercise.sets.length,
    0
  );
  const completedSets = state.exercises.reduce(
    (total, exercise) =>
      total +
      exercise.sets.filter((workoutSet) => workoutSet.isCompleted).length,
    0
  );
  const completionRate =
    plannedSets > 0 ? Math.round((completedSets / plannedSets) * 100) : 0;
  const durationSeconds = state.startedAtMs
    ? Math.max(0, Math.floor((Date.now() - state.startedAtMs) / 1000))
    : 0;

  return { completedSets, plannedSets, completionRate, durationSeconds };
}

function trackStaleAbandonment(state: WorkoutState): void {
  if (!state.isActive || !state.workoutSessionId || !state.startedAtMs) return;

  const elapsedSeconds = Math.max(
    0,
    Math.floor((Date.now() - state.startedAtMs) / 1000)
  );
  const staleAfterSeconds = 24 * 60 * 60;
  if (elapsedSeconds < staleAfterSeconds) return;

  const metrics = getWorkoutMetrics(state);
  trackEvent("workout_abandoned", {
    workout_session_id: state.workoutSessionId,
    workout_source: state.workoutSource,
    workout_id: state.workoutId,
    completed_sets: metrics.completedSets,
    completion_rate: metrics.completionRate,
    duration_seconds: elapsedSeconds,
    elapsed_seconds: elapsedSeconds,
    stale_after_hours: 24,
  });
}

function trackFirstSetIfNeeded(
  get: () => WorkoutState,
  set: (next: Partial<WorkoutState>) => void
): void {
  const state = get();
  if (!state.isActive || state.firstSetLogged || !state.workoutSessionId)
    return;
  const hasLoggedSet = state.exercises.some((exercise) =>
    exercise.sets.some(hasLoggedSetData)
  );
  if (!hasLoggedSet) return;

  const secondsSinceStart = state.startedAtMs
    ? Math.max(0, Math.floor((Date.now() - state.startedAtMs) / 1000))
    : 0;
  set({ firstSetLogged: true });
  trackEvent("workout_first_set_logged", {
    workout_session_id: state.workoutSessionId,
    seconds_since_start: secondsSinceStart,
  });
}

function trackProgressIfNeeded(
  get: () => WorkoutState,
  set: (next: Partial<WorkoutState>) => void
): void {
  const state = get();
  if (!state.isActive || state.progressReached50 || !state.workoutSessionId)
    return;
  const metrics = getWorkoutMetrics(state);
  if (
    metrics.plannedSets === 0 ||
    metrics.completedSets / metrics.plannedSets < 0.5
  ) {
    return;
  }

  const secondsSinceStart = state.startedAtMs
    ? Math.max(0, Math.floor((Date.now() - state.startedAtMs) / 1000))
    : 0;
  set({ progressReached50: true });
  trackEvent("workout_progress_reached", {
    workout_session_id: state.workoutSessionId,
    progress_percent: 50,
    completed_sets: metrics.completedSets,
    total_sets: metrics.plannedSets,
    seconds_since_start: secondsSinceStart,
  });
}

export function getExerciseOccurrenceId(exercise: WorkoutExercise): string {
  return exercise.occurrenceId ?? exercise.id;
}

function resolveExerciseOccurrence(
  exercises: WorkoutExercise[],
  identifier: string
): WorkoutExercise | undefined {
  const exactOccurrence = exercises.find(
    (exercise) => exercise.occurrenceId === identifier
  );
  if (exactOccurrence) return exactOccurrence;

  const catalogMatches = exercises.filter(
    (exercise) => exercise.id === identifier
  );
  return catalogMatches.length === 1 ? catalogMatches[0] : undefined;
}

function updateExerciseSets(
  exercises: WorkoutExercise[],
  exerciseId: string,
  updater: (sets: WorkoutSet[]) => WorkoutSet[]
): WorkoutExercise[] {
  const occurrence = resolveExerciseOccurrence(exercises, exerciseId);
  if (!occurrence) return exercises;
  return exercises.map((ex) =>
    ex === occurrence ? { ...ex, sets: updater(ex.sets) } : ex
  );
}

function reorderExercises(
  exercises: WorkoutExercise[],
  exerciseId: string,
  targetIndex: number
): WorkoutExercise[] {
  const occurrence = resolveExerciseOccurrence(exercises, exerciseId);
  const currentIndex = occurrence ? exercises.indexOf(occurrence) : -1;
  const boundedTargetIndex = Math.max(
    0,
    Math.min(exercises.length - 1, targetIndex)
  );
  if (currentIndex === -1 || currentIndex === boundedTargetIndex) {
    return exercises;
  }

  const reordered = [...exercises];
  const [movedExercise] = reordered.splice(currentIndex, 1);
  if (!movedExercise) return exercises;
  reordered.splice(boundedTargetIndex, 0, movedExercise);
  return reordered;
}

function makeExercise(exercise: {
  id: string;
  name: string;
  image?: ExerciseImageData;
  exerciseType?: "weight" | "time";
  previous?: ExercisePreviousSets;
  reasoning?: WorkoutExerciseReasoning | null;
}): WorkoutExercise {
  const exerciseType = exercise.exerciseType ?? "weight";
  return {
    id: exercise.id,
    occurrenceId: generateOccurrenceId(),
    name: exercise.name,
    image: exercise.image ?? null,
    exerciseType,
    restDurationSeconds: 90,
    notes: "",
    reasoning: exercise.reasoning ?? null,
    difficultyFeedback: null,
    sets: buildExerciseSets({
      exerciseType,
      previous: exercise.previous,
    }),
  };
}

/** Pure v0→v1 persisted-store migration helper for deterministic unit tests. */
export function migratePersistedWorkoutExercisesFromV0(
  exercises: WorkoutExercise[]
): WorkoutExercise[] {
  return exercises.map((exercise) => {
    const exerciseType = exercise.exerciseType ?? "weight";
    if (exerciseType !== "weight") {
      return { ...exercise, exerciseType };
    }

    const hasWarmup = exercise.sets.some((set) => set.type === "warmup");
    if (hasWarmup) {
      return { ...exercise, exerciseType };
    }

    return {
      ...exercise,
      exerciseType,
      sets: normalizeSetsForExerciseType(exerciseType, exercise.sets),
    };
  });
}

export const useWorkoutStore = create<WorkoutState & WorkoutActions>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        ...initialState,

        startWorkout: (
          name,
          exercises,
          generationMeta,
          warmup = null,
          options
        ) => {
          const previousState = get();
          trackStaleAbandonment(previousState);
          const workoutSessionId = generateWorkoutSessionId();
          const workoutSource =
            options?.workoutSource ?? (generationMeta ? "queued_ai" : "manual");
          const workoutId = options?.workoutId ?? null;
          const wasEdited = options?.wasEdited ?? false;
          const editCount = options?.editCount ?? 0;

          set({
            isActive: true,
            workoutName: name,
            warmup,
            exercises: exercises.map((exercise) => ({
              ...exercise,
              occurrenceId: exercise.occurrenceId ?? generateOccurrenceId(),
            })),
            startedAtMs: Date.now(),
            restTimer: null,
            completedWorkoutSummary: null,
            generationMeta: generationMeta ?? null,
            workoutSessionId,
            workoutSource,
            workoutId,
            workoutWasEdited: wasEdited,
            workoutEditCount: editCount,
            firstSetLogged: false,
            progressReached50: false,
            watchSelectedExerciseId: null,
            healthWorkoutOwnedByWatch: false,
          });

          const plannedSetCount = exercises.reduce(
            (total, exercise) => total + exercise.sets.length,
            0
          );
          trackEvent("workout_started", {
            workout_session_id: workoutSessionId,
            workout_source: workoutSource,
            workout_id: workoutId,
            generation_source: generationMeta?.generationSource ?? null,
            exercise_count: exercises.length,
            planned_set_count: plannedSetCount,
            has_warmup: warmup !== null,
            was_edited: wasEdited,
            edit_count: editCount,
          });
        },

        finishWorkout: (healthWorkoutUUID) => {
          const {
            workoutName,
            warmup,
            exercises,
            startedAtMs,
            healthWorkoutOwnedByWatch,
          } = get();
          const now = Date.now();
          set({
            isActive: false,
            restTimer: null,
            completedWorkoutSummary: {
              workoutName,
              warmup,
              durationMs: startedAtMs ? now - startedAtMs : 0,
              exercises,
              finishedAtMs: now,
              healthWorkoutRecordedOnWatch:
                healthWorkoutOwnedByWatch || healthWorkoutUUID !== undefined,
              healthWorkoutUUID,
              workoutSessionId: get().workoutSessionId,
              workoutSource: get().workoutSource,
              workoutId: get().workoutId,
              generationSource: get().generationMeta?.generationSource ?? null,
              wasEdited: get().workoutWasEdited,
              editCount: get().workoutEditCount,
            },
          });
        },

        setWatchSelectedExercise: (watchSelectedExerciseId) =>
          set({ watchSelectedExerciseId }),

        markHealthWorkoutOwnedByWatch: () =>
          set({ healthWorkoutOwnedByWatch: true }),

        clearWorkout: (options) => {
          if (!options?.suppressAbandonment) {
            trackStaleAbandonment(get());
          }
          set(initialState);
        },

        toggleSetComplete: (exerciseId, setId) => {
          const { exercises } = get();
          const exercise = resolveExerciseOccurrence(exercises, exerciseId);
          const targetSet = exercise?.sets.find((s) => s.id === setId);
          const willComplete = targetSet ? !targetSet.isCompleted : false;

          set({
            exercises: updateExerciseSets(exercises, exerciseId, (sets) =>
              sets.map((s) =>
                s.id === setId ? { ...s, isCompleted: !s.isCompleted } : s
              )
            ),
          });

          if (willComplete && exercise) {
            get().startRestTimer(exerciseId);
          }
          trackFirstSetIfNeeded(get, (next) => set(next));
          trackProgressIfNeeded(get, (next) => set(next));
        },

        updateSetField: (exerciseId, setId, field, value) => {
          set((state) => ({
            exercises: updateExerciseSets(state.exercises, exerciseId, (sets) =>
              sets.map((s) => (s.id === setId ? { ...s, [field]: value } : s))
            ),
          }));
          trackFirstSetIfNeeded(get, (next) => set(next));
        },

        updateSetDuration: (exerciseId, setId, durationSeconds) => {
          set((state) => ({
            exercises: updateExerciseSets(state.exercises, exerciseId, (sets) =>
              sets.map((s) => (s.id === setId ? { ...s, durationSeconds } : s))
            ),
          }));
          trackFirstSetIfNeeded(get, (next) => set(next));
        },

        updateSetRpe: (exerciseId, setId, rpe) => {
          set((state) => ({
            exercises: updateExerciseSets(state.exercises, exerciseId, (sets) =>
              sets.map((s) => (s.id === setId ? { ...s, rpe } : s))
            ),
          }));
          trackFirstSetIfNeeded(get, (next) => set(next));
        },

        toggleWarmupComplete: () => {
          set((state) => ({
            warmup: state.warmup
              ? {
                  ...state.warmup,
                  isCompleted: !state.warmup.isCompleted,
                }
              : null,
          }));
          trackProgressIfNeeded(get, (next) => set(next));
        },

        addSet: (exerciseId) =>
          set((state) => ({
            exercises: updateExerciseSets(
              state.exercises,
              exerciseId,
              (sets) => [...sets, makeEmptyWorkingSet()]
            ),
          })),

        removeSet: (exerciseId, setId) =>
          set((state) => ({
            exercises: updateExerciseSets(state.exercises, exerciseId, (sets) =>
              sets.filter((s) => s.id !== setId)
            ),
          })),

        updateNotes: (exerciseId, notes) =>
          set((state) => ({
            exercises: (() => {
              const occurrence = resolveExerciseOccurrence(
                state.exercises,
                exerciseId
              );
              return state.exercises.map((ex) =>
                ex === occurrence ? { ...ex, notes } : ex
              );
            })(),
          })),

        setExerciseDifficultyFeedback: (exerciseId, difficultyFeedback) =>
          set((state) => ({
            exercises: (() => {
              const occurrence = resolveExerciseOccurrence(
                state.exercises,
                exerciseId
              );
              return state.exercises.map((ex) =>
                ex === occurrence ? { ...ex, difficultyFeedback } : ex
              );
            })(),
            completedWorkoutSummary: state.completedWorkoutSummary
              ? {
                  ...state.completedWorkoutSummary,
                  exercises: state.completedWorkoutSummary.exercises.map(
                    (ex) =>
                      ex.id === exerciseId ? { ...ex, difficultyFeedback } : ex
                  ),
                }
              : state.completedWorkoutSummary,
          })),

        replaceExercise: (exerciseId, newExercise, previous) =>
          set((state) => {
            const occurrence = resolveExerciseOccurrence(
              state.exercises,
              exerciseId
            );
            return {
              exercises: state.exercises.map((ex) => {
                if (ex !== occurrence) return ex;

                const exerciseType =
                  newExercise.exerciseType ?? ex.exerciseType;
                const workingCount = countWorkingSets(ex.sets);
                const sets = buildExerciseSets({
                  exerciseType,
                  workingCount,
                  previous,
                });

                return {
                  ...ex,
                  id: newExercise.id,
                  name: newExercise.name,
                  image: newExercise.image ?? null,
                  exerciseType,
                  notes: "",
                  reasoning: null,
                  difficultyFeedback: null,
                  progressionType: "new_exercise",
                  sets,
                };
              }),
            };
          }),

        startRestTimer: (exerciseId) => {
          const exercise = resolveExerciseOccurrence(
            get().exercises,
            exerciseId
          );
          if (!exercise) return;
          set({
            restTimer: {
              id: generateRestTimerId(),
              exerciseId: getExerciseOccurrenceId(exercise),
              startedAtMs: Date.now(),
              durationSeconds: exercise.restDurationSeconds,
            },
          });
        },

        adjustRestTimer: (deltaSeconds) =>
          set((state) => {
            if (!state.restTimer) return state;
            const now = Date.now();
            const durationSeconds = Math.max(
              1,
              state.restTimer.durationSeconds
            );
            const remainingSeconds =
              state.restTimer.pausedRemainingSeconds ??
              Math.min(
                durationSeconds,
                Math.max(
                  0,
                  durationSeconds - (now - state.restTimer.startedAtMs) / 1000
                )
              );
            const nextRemainingSeconds = Math.min(
              600,
              Math.max(0, remainingSeconds + deltaSeconds)
            );
            const nextDurationSeconds = Math.max(
              durationSeconds,
              nextRemainingSeconds
            );
            const nextElapsedSeconds =
              nextDurationSeconds - nextRemainingSeconds;

            return {
              restTimer: {
                ...state.restTimer,
                durationSeconds: nextDurationSeconds,
                startedAtMs: now - nextElapsedSeconds * 1000,
                pausedRemainingSeconds:
                  state.restTimer.pausedRemainingSeconds === undefined
                    ? undefined
                    : nextRemainingSeconds,
              },
            };
          }),

        pauseRestTimer: () =>
          set((state) => {
            if (
              !state.restTimer ||
              state.restTimer.pausedRemainingSeconds !== undefined
            ) {
              return state;
            }
            const elapsedSeconds =
              (Date.now() - state.restTimer.startedAtMs) / 1000;
            return {
              restTimer: {
                ...state.restTimer,
                pausedRemainingSeconds: Math.min(
                  state.restTimer.durationSeconds,
                  Math.max(0, state.restTimer.durationSeconds - elapsedSeconds)
                ),
              },
            };
          }),

        resumeRestTimer: () =>
          set((state) => {
            if (
              !state.restTimer ||
              state.restTimer.pausedRemainingSeconds === undefined
            ) {
              return state;
            }
            const pausedRemainingSeconds =
              state.restTimer.pausedRemainingSeconds;
            return {
              restTimer: {
                ...state.restTimer,
                startedAtMs:
                  Date.now() -
                  (state.restTimer.durationSeconds - pausedRemainingSeconds) *
                    1000,
                pausedRemainingSeconds: undefined,
              },
            };
          }),

        skipRestTimer: () => set({ restTimer: null }),

        addExercise: (exercise) =>
          set((state) => ({
            exercises: [...state.exercises, makeExercise(exercise)],
          })),

        addExerciseAfter: (afterExerciseId, exercise) =>
          set((state) => {
            const afterOccurrence = resolveExerciseOccurrence(
              state.exercises,
              afterExerciseId
            );
            const index = afterOccurrence
              ? state.exercises.indexOf(afterOccurrence)
              : -1;
            const newExercise = makeExercise(exercise);

            if (index === -1) {
              return { exercises: [...state.exercises, newExercise] };
            }

            return {
              exercises: [
                ...state.exercises.slice(0, index + 1),
                newExercise,
                ...state.exercises.slice(index + 1),
              ],
            };
          }),

        reorderExercise: (exerciseId, targetIndex) =>
          set((state) => ({
            exercises: reorderExercises(
              state.exercises,
              exerciseId,
              targetIndex
            ),
          })),

        removeExercise: (exerciseId) =>
          set((state) => {
            const occurrence = resolveExerciseOccurrence(
              state.exercises,
              exerciseId
            );
            const occurrenceId = occurrence
              ? getExerciseOccurrenceId(occurrence)
              : null;
            return {
              exercises: occurrence
                ? state.exercises.filter((ex) => ex !== occurrence)
                : state.exercises,
              restTimer:
                occurrenceId && state.restTimer?.exerciseId === occurrenceId
                  ? null
                  : state.restTimer,
            };
          }),

        updateWorkoutName: (name) => set({ workoutName: name }),
      }),
      {
        name: "active-workout-storage",
        version: 1,
        storage: createJSONStorage(() => AsyncStorage),
        migrate: (persistedState, version) => {
          if (!persistedState || typeof persistedState !== "object") {
            return persistedState as WorkoutState;
          }

          const state = persistedState as WorkoutState & {
            exercises?: WorkoutExercise[];
          };

          if (version < 1 && Array.isArray(state.exercises)) {
            state.exercises = migratePersistedWorkoutExercisesFromV0(
              state.exercises
            );
          }

          return state;
        },
        onRehydrateStorage: () => (state, error) => {
          if (error) {
            console.warn("[workout-store] hydration failed, resetting:", error);
            state?.clearWorkout();
          } else if (state) {
            // Migrate hydrated exercises to ensure new fields exist
            state.warmup = state.warmup ?? null;
            state.watchSelectedExerciseId =
              state.watchSelectedExerciseId ?? null;
            state.healthWorkoutOwnedByWatch =
              state.healthWorkoutOwnedByWatch ?? false;
            state.workoutSessionId = state.workoutSessionId ?? null;
            state.workoutSource = state.workoutSource ?? null;
            state.workoutId = state.workoutId ?? null;
            state.workoutWasEdited = state.workoutWasEdited ?? false;
            state.workoutEditCount = state.workoutEditCount ?? 0;
            state.firstSetLogged = state.firstSetLogged ?? false;
            state.progressReached50 = state.progressReached50 ?? false;
            state.exercises = state.exercises.map((ex) => ({
              ...ex,
              occurrenceId: ex.occurrenceId ?? generateOccurrenceId(),
              exerciseType: ex.exerciseType ?? "weight",
              reasoning: ex.reasoning ?? null,
              sets: ex.sets.map((s) => ({
                ...s,
                durationSeconds: s.durationSeconds ?? null,
              })),
            }));
            if (state.restTimer) {
              const occurrence = resolveExerciseOccurrence(
                state.exercises,
                state.restTimer.exerciseId
              );
              state.restTimer = {
                ...state.restTimer,
                id: state.restTimer.id ?? generateRestTimerId(),
                exerciseId: occurrence
                  ? getExerciseOccurrenceId(occurrence)
                  : state.restTimer.exerciseId,
              };
            }
            state.generationMeta = state.generationMeta
              ? {
                  ...state.generationMeta,
                  reasoning: state.generationMeta.reasoning ?? null,
                }
              : null;
          }
        },
      }
    )
  )
);
