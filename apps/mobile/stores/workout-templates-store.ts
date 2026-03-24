import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface WorkoutTemplateExercise {
  id: string;
  name: string;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  exercises: WorkoutTemplateExercise[];
  createdAt: number;
}

interface WorkoutTemplatesState {
  templates: WorkoutTemplate[];
}

interface WorkoutTemplatesActions {
  addTemplate: (template: Omit<WorkoutTemplate, "id" | "createdAt">) => void;
  removeTemplate: (id: string) => void;
  updateTemplate: (
    id: string,
    updates: Partial<Pick<WorkoutTemplate, "name" | "exercises">>
  ) => void;
  resetTemplates: () => void;
}

const initialState: WorkoutTemplatesState = {
  templates: [],
};

export const useWorkoutTemplatesStore = create<
  WorkoutTemplatesState & WorkoutTemplatesActions
>()(
  persist(
    (set) => ({
      ...initialState,

      addTemplate: (template) =>
        set((state) => ({
          templates: [
            {
              id: `template-${Date.now()}`,
              createdAt: Date.now(),
              ...template,
            },
            ...state.templates,
          ],
        })),

      removeTemplate: (id) =>
        set((state) => ({
          templates: state.templates.filter((t) => t.id !== id),
        })),

      updateTemplate: (id, updates) =>
        set((state) => ({
          templates: state.templates.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          ),
        })),

      resetTemplates: () => set(initialState),
    }),
    {
      name: "workout-templates-storage",
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          // Corrupted storage — reset to empty state; do not surface to user
          console.warn(
            "[workout-templates-store] hydration failed, resetting:",
            error
          );
          state?.resetTemplates();
        }
      },
    }
  )
);
