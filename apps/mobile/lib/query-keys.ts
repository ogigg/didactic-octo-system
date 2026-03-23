import type { ExerciseFilters } from "@/lib/api/exercises";

export const profileKeys = {
  all: ["profiles"] as const,
  detail: (userId: string) => [...profileKeys.all, userId] as const,
};

export const exerciseKeys = {
  all: ["exercises"] as const,
  list: (filters?: ExerciseFilters) =>
    [...exerciseKeys.all, "list", filters ?? {}] as const,
  detail: (id: string) => [...exerciseKeys.all, id] as const,
};

export const workoutKeys = {
  all: ["workouts"] as const,
  list: () => [...workoutKeys.all, "list"] as const,
  detail: (id: string) => [...workoutKeys.all, id] as const,
};
