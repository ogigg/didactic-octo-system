import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import {
  createJSONStorage,
  persist,
  subscribeWithSelector,
} from "zustand/middleware";
import type { ExerciseImageData } from "@/lib/exercise-media";

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
  }) => void;
  addExerciseAfter: (
    afterExerciseId: string,
    exercise: {
      id: string;
      name: string;
      image?: ExerciseImageData;
      exerciseType?: "weight" | "time";
      previousDisplays?: string[];
    }
  ) => void;
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
};

let setCounter = 0;

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
}): WorkoutExercise {
  return {
    id: exercise.id,
    name: exercise.name,
    image: exercise.image ?? null,
    exerciseType: exercise.exerciseType ?? "weight",
    restDurationSeconds: 90,
    notes: "",
    difficultyFeedback: null,
    sets: Array.from({ length: 3 }, (_, index) =>
      makeEmptySet(exercise.previousDisplays?.[index] ?? null)
    ),
  };
}

export const useWorkoutStore = create<WorkoutState & WorkoutActions>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
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
            return {
              restTimer: {
                ...state.restTimer,
                durationSeconds: Math.max(
                  15,
                  state.restTimer.durationSeconds + deltaSeconds
                ),
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
        name: "active-workout-storage",
        storage: createJSONStorage(() => AsyncStorage),
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
              sets: ex.sets.map((s) => ({
                ...s,
                durationSeconds: s.durationSeconds ?? null,
              })),
            }));
          }
        },
      }
    )
  )
);
