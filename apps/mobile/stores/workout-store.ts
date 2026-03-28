import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface WorkoutSet {
  id: string;
  type: "warmup" | "working";
  kg: string;
  reps: string;
  rpe: number | null;
  isCompleted: boolean;
  previousDisplay: string | null;
}

export interface WorkoutExercise {
  id: string;
  name: string;
  restDurationSeconds: number;
  notes: string;
  sets: WorkoutSet[];
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
  exercises: WorkoutExercise[];
  startedAtMs: number | null;
  restTimer: RestTimerState | null;
  completedWorkoutSummary: WorkoutSummary | null;
  generationMeta: GenerationMeta | null;
}

export interface WorkoutSummary {
  workoutName: string;
  durationMs: number;
  exercises: WorkoutExercise[];
  finishedAtMs: number;
}

interface WorkoutActions {
  startWorkout: (
    name: string,
    exercises: WorkoutExercise[],
    generationMeta?: GenerationMeta
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
  updateSetRpe: (exerciseId: string, setId: string, rpe: number | null) => void;
  addSet: (exerciseId: string) => void;
  removeSet: (exerciseId: string, setId: string) => void;
  updateNotes: (exerciseId: string, notes: string) => void;
  replaceExercise: (
    exerciseId: string,
    newExercise: { id: string; name: string }
  ) => void;
  startRestTimer: (exerciseId: string) => void;
  adjustRestTimer: (deltaSeconds: number) => void;
  skipRestTimer: () => void;
  addExercise: (exercise: { id: string; name: string }) => void;
  removeExercise: (exerciseId: string) => void;
  updateWorkoutName: (name: string) => void;
}

const initialState: WorkoutState = {
  isActive: false,
  workoutName: "",
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

export const useWorkoutStore = create<WorkoutState & WorkoutActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      startWorkout: (name, exercises, generationMeta) =>
        set({
          isActive: true,
          workoutName: name,
          exercises,
          startedAtMs: Date.now(),
          restTimer: null,
          completedWorkoutSummary: null,
          generationMeta: generationMeta ?? null,
        }),

      finishWorkout: () => {
        const { workoutName, exercises, startedAtMs } = get();
        const now = Date.now();
        set({
          isActive: false,
          restTimer: null,
          completedWorkoutSummary: {
            workoutName,
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

      updateSetRpe: (exerciseId, setId, rpe) =>
        set((state) => ({
          exercises: updateExerciseSets(state.exercises, exerciseId, (sets) =>
            sets.map((s) => (s.id === setId ? { ...s, rpe } : s))
          ),
        })),

      addSet: (exerciseId) =>
        set((state) => ({
          exercises: updateExerciseSets(state.exercises, exerciseId, (sets) => [
            ...sets,
            {
              id: generateSetId(),
              type: "working",
              kg: "",
              reps: "",
              rpe: null,
              isCompleted: false,
              previousDisplay: null,
            },
          ]),
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

      replaceExercise: (exerciseId, newExercise) =>
        set((state) => ({
          exercises: state.exercises.map((ex) =>
            ex.id === exerciseId
              ? { ...ex, id: newExercise.id, name: newExercise.name }
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
          exercises: [
            ...state.exercises,
            {
              id: exercise.id,
              name: exercise.name,
              restDurationSeconds: 90,
              notes: "",
              sets: Array.from({ length: 3 }, () => ({
                id: generateSetId(),
                type: "working" as const,
                kg: "",
                reps: "",
                rpe: null,
                isCompleted: false,
                previousDisplay: null,
              })),
            },
          ],
        })),

      removeExercise: (exerciseId) =>
        set((state) => ({
          exercises: state.exercises.filter((ex) => ex.id !== exerciseId),
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
        }
      },
    }
  )
);
