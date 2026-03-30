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
  forDay: (dateKey: string) => [...workoutKeys.all, "forDay", dateKey] as const,
  detail: (id: string) => [...workoutKeys.all, id] as const,
};

export const workoutStatsKeys = {
  all: ["workout-stats"] as const,
};

export const calendarKeys = {
  all: ["calendar"] as const,
  entries: () => [...calendarKeys.all, "entries"] as const,
};

export const exerciseMuscleKeys = {
  byIds: (ids: string[]) => ["exercise-muscles", ...ids.sort()] as const,
};

export const statsKeys = {
  all: ["stats"] as const,
  heatmap: () => [...statsKeys.all, "heatmap"] as const,
  volume: (period: string) => [...statsKeys.all, "volume", period] as const,
  prs: () => [...statsKeys.all, "prs"] as const,
  muscleDistribution: (period: string) =>
    [...statsKeys.all, "muscle-distribution", period] as const,
};
