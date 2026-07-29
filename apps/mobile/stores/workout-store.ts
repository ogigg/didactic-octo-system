import type { ExerciseImageData } from "@/lib/exercise-media";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import {
  createJSONStorage,
  persist,
  type StateStorage,
  subscribeWithSelector,
} from "zustand/middleware";

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

interface RestTimerState {
  exerciseId: string;
  startedAtMs: number;
  durationSeconds: number;
}

export interface GenerationMeta {
  generationSource: "llm" | "fallback_template" | "fallback_substitution";
  goalSnapshot: "build_strength" | "lose_weight" | "improve_fitness" | "custom";
  customGoalSnapshot: string | null;
  reasoning?: WorkoutReasoning | null;
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
}

export interface WorkoutSummary {
  workoutName: string;
  warmup: WorkoutWarmup | null;
  durationMs: number;
  exercises: WorkoutExercise[];
  finishedAtMs: number;
}

interface WorkoutActions {
  startWorkout: (
    name: string,
    exercises: WorkoutExercise[],
    generationMeta?: GenerationMeta,
    warmup?: WorkoutWarmup | null
  ) => void;
  finishWorkout: () => void;
  clearWorkout: () => void;
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
    }
  ) => void;
  startRestTimer: (exerciseId: string) => void;
  adjustRestTimer: (deltaSeconds: number) => void;
  skipRestTimer: () => void;
  addExercise: (exercise: {
    id: string;
    name: string;
    image?: ExerciseImageData;
    exerciseType?: "weight" | "time";
    previousDisplays?: string[];
    reasoning?: WorkoutExerciseReasoning | null;
  }) => Promise<void>;
  addExerciseAfter: (
    afterExerciseId: string,
    exercise: {
      id: string;
      name: string;
      image?: ExerciseImageData;
      exerciseType?: "weight" | "time";
      previousDisplays?: string[];
      reasoning?: WorkoutExerciseReasoning | null;
    }
  ) => Promise<void>;
  hydrateExercisePreviousDisplays: (
    exerciseId: string,
    previousDisplays: string[]
  ) => Promise<void>;
  reorderExercise: (exerciseId: string, targetIndex: number) => void;
  removeExercise: (exerciseId: string) => void;
  updateWorkoutName: (name: string) => void;
}

interface WorkoutStore extends WorkoutState, WorkoutActions {}

const initialState: WorkoutState = {
  isActive: false,
  workoutName: "",
  warmup: null,
  exercises: [],
  startedAtMs: null,
  restTimer: null,
  completedWorkoutSummary: null,
  generationMeta: null,
};

let setCounter = 0;
let suppressAutomaticWorkoutPersistence = false;

export const activeWorkoutStateStorage: StateStorage = {
  getItem: (name) => AsyncStorage.getItem(name),
  removeItem: (name) => AsyncStorage.removeItem(name),
  setItem: (name, value) => {
    if (suppressAutomaticWorkoutPersistence) {
      suppressAutomaticWorkoutPersistence = false;
      return Promise.resolve();
    }

    try {
      return AsyncStorage.setItem(name, value);
    } catch (error) {
      return Promise.reject(error);
    }
  },
};

const ACTIVE_WORKOUT_STORAGE_KEY = "active-workout-storage";
const workoutPersistStorage = createJSONStorage<WorkoutStore>(
  () => activeWorkoutStateStorage
);

function updateAndPersistWorkout(
  update: () => void,
  getState: () => WorkoutStore
): Promise<void> {
  suppressAutomaticWorkoutPersistence = true;
  try {
    update();
  } finally {
    suppressAutomaticWorkoutPersistence = false;
  }

  return Promise.resolve(
    activeWorkoutStateStorage.setItem(
      ACTIVE_WORKOUT_STORAGE_KEY,
      JSON.stringify({
        state: getState(),
        version: 0,
      })
    )
  ).then(() => undefined);
}

function generateSetId(): string {
  setCounter += 1;
  return `set-${Date.now()}-${setCounter}`;
}

function updateExerciseSets(
  exercises: WorkoutExercise[],
  exerciseId: string,
  updater: (sets: WorkoutSet[]) => WorkoutSet[]
): WorkoutExercise[] {
  return exercises.map((ex) =>
    ex.id === exerciseId ? { ...ex, sets: updater(ex.sets) } : ex
  );
}

function reorderExercises(
  exercises: WorkoutExercise[],
  exerciseId: string,
  targetIndex: number
): WorkoutExercise[] {
  const currentIndex = exercises.findIndex(
    (exercise) => exercise.id === exerciseId
  );
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

function makeEmptySet(previousDisplay: string | null = null): WorkoutSet {
  return {
    id: generateSetId(),
    type: "working",
    kg: "",
    reps: "",
    durationSeconds: null,
    rpe: null,
    isCompleted: false,
    previousDisplay,
  };
}

function clearSetValues(set: WorkoutSet): WorkoutSet {
  return {
    ...set,
    kg: "",
    reps: "",
    durationSeconds: null,
    rpe: null,
    isCompleted: false,
    previousDisplay: null,
  };
}

function makeExercise(exercise: {
  id: string;
  name: string;
  image?: ExerciseImageData;
  exerciseType?: "weight" | "time";
  previousDisplays?: string[];
  reasoning?: WorkoutExerciseReasoning | null;
}): WorkoutExercise {
  return {
    id: exercise.id,
    name: exercise.name,
    image: exercise.image ?? null,
    exerciseType: exercise.exerciseType ?? "weight",
    restDurationSeconds: 90,
    notes: "",
    reasoning: exercise.reasoning ?? null,
    difficultyFeedback: null,
    sets: Array.from({ length: 3 }, (_, index) =>
      makeEmptySet(exercise.previousDisplays?.[index] ?? null)
    ),
  };
}

export const useWorkoutStore = create<WorkoutStore>()(
  subscribeWithSelector(
    persist(
      (set, get, store) => ({
        ...initialState,

        startWorkout: (name, exercises, generationMeta, warmup = null) =>
          set({
            isActive: true,
            workoutName: name,
            warmup,
            exercises,
            startedAtMs: Date.now(),
            restTimer: null,
            completedWorkoutSummary: null,
            generationMeta: generationMeta ?? null,
          }),

        finishWorkout: () => {
          const { workoutName, warmup, exercises, startedAtMs } = get();
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
            },
          });
        },

        clearWorkout: () => set(initialState),

        toggleSetComplete: (exerciseId, setId) => {
          const { exercises } = get();
          const exercise = exercises.find((e) => e.id === exerciseId);
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
        },

        updateSetField: (exerciseId, setId, field, value) =>
          set((state) => ({
            exercises: updateExerciseSets(state.exercises, exerciseId, (sets) =>
              sets.map((s) => (s.id === setId ? { ...s, [field]: value } : s))
            ),
          })),

        updateSetDuration: (exerciseId, setId, durationSeconds) =>
          set((state) => ({
            exercises: updateExerciseSets(state.exercises, exerciseId, (sets) =>
              sets.map((s) => (s.id === setId ? { ...s, durationSeconds } : s))
            ),
          })),

        updateSetRpe: (exerciseId, setId, rpe) =>
          set((state) => ({
            exercises: updateExerciseSets(state.exercises, exerciseId, (sets) =>
              sets.map((s) => (s.id === setId ? { ...s, rpe } : s))
            ),
          })),

        toggleWarmupComplete: () =>
          set((state) => ({
            warmup: state.warmup
              ? {
                  ...state.warmup,
                  isCompleted: !state.warmup.isCompleted,
                }
              : null,
          })),

        addSet: (exerciseId) =>
          set((state) => ({
            exercises: updateExerciseSets(
              state.exercises,
              exerciseId,
              (sets) => [...sets, makeEmptySet()]
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
            exercises: state.exercises.map((ex) =>
              ex.id === exerciseId ? { ...ex, notes } : ex
            ),
          })),

        setExerciseDifficultyFeedback: (exerciseId, difficultyFeedback) =>
          set((state) => ({
            exercises: state.exercises.map((ex) =>
              ex.id === exerciseId ? { ...ex, difficultyFeedback } : ex
            ),
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

        replaceExercise: (exerciseId, newExercise) =>
          set((state) => ({
            exercises: state.exercises.map((ex) =>
              ex.id === exerciseId
                ? {
                    ...ex,
                    id: newExercise.id,
                    name: newExercise.name,
                    image: newExercise.image ?? null,
                    exerciseType: newExercise.exerciseType ?? ex.exerciseType,
                    notes: "",
                    reasoning: null,
                    difficultyFeedback: null,
                    progressionType: "new_exercise",
                    sets: ex.sets.map(clearSetValues),
                  }
                : ex
            ),
          })),

        startRestTimer: (exerciseId) => {
          const exercise = get().exercises.find((e) => e.id === exerciseId);
          if (!exercise) return;
          set({
            restTimer: {
              exerciseId,
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
            const elapsedSeconds = (now - state.restTimer.startedAtMs) / 1000;
            const remainingSeconds = Math.min(
              durationSeconds,
              Math.max(0, durationSeconds - elapsedSeconds)
            );
            const nextRemainingSeconds = Math.min(
              durationSeconds,
              Math.max(0, remainingSeconds + deltaSeconds)
            );
            const nextElapsedSeconds = durationSeconds - nextRemainingSeconds;

            return {
              restTimer: {
                ...state.restTimer,
                startedAtMs: now - nextElapsedSeconds * 1000,
              },
            };
          }),

        skipRestTimer: () => set({ restTimer: null }),

        addExercise: (exercise) =>
          updateAndPersistWorkout(
            () =>
              store.setState((state) => ({
                exercises: [...state.exercises, makeExercise(exercise)],
              })),
            get
          ),

        addExerciseAfter: (afterExerciseId, exercise) =>
          updateAndPersistWorkout(
            () =>
              store.setState((state) => {
                const index = state.exercises.findIndex(
                  (ex) => ex.id === afterExerciseId
                );
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
            get
          ),

        hydrateExercisePreviousDisplays: (exerciseId, previousDisplays) =>
          updateAndPersistWorkout(
            () =>
              store.setState((state) => ({
                exercises: state.exercises.map((exercise) =>
                  exercise.id === exerciseId
                    ? {
                        ...exercise,
                        sets: exercise.sets.map((workoutSet, index) => ({
                          ...workoutSet,
                          previousDisplay:
                            previousDisplays[index] ??
                            workoutSet.previousDisplay ??
                            null,
                        })),
                      }
                    : exercise
                ),
              })),
            get
          ),

        reorderExercise: (exerciseId, targetIndex) =>
          set((state) => ({
            exercises: reorderExercises(
              state.exercises,
              exerciseId,
              targetIndex
            ),
          })),

        removeExercise: (exerciseId) =>
          set((state) => ({
            exercises: state.exercises.filter((ex) => ex.id !== exerciseId),
            restTimer:
              state.restTimer?.exerciseId === exerciseId
                ? null
                : state.restTimer,
          })),

        updateWorkoutName: (name) => set({ workoutName: name }),
      }),
      {
        name: ACTIVE_WORKOUT_STORAGE_KEY,
        storage: workoutPersistStorage,
        onRehydrateStorage: () => (state, error) => {
          if (error) {
            console.warn("[workout-store] hydration failed, resetting:", error);
            state?.clearWorkout();
          } else if (state) {
            // Migrate hydrated exercises to ensure new fields exist
            state.warmup = state.warmup ?? null;
            state.exercises = state.exercises.map((ex) => ({
              ...ex,
              exerciseType: ex.exerciseType ?? "weight",
              reasoning: ex.reasoning ?? null,
              sets: ex.sets.map((s) => ({
                ...s,
                durationSeconds: s.durationSeconds ?? null,
              })),
            }));
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
