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

export const pendingWorkoutKeys = {
  all: ["pending-workouts"] as const,
  list: () => [...pendingWorkoutKeys.all, "list"] as const,
  detail: (id: string) => [...pendingWorkoutKeys.all, id] as const,
};

export const exerciseDetailKeys = {
  all: ["exercise-detail"] as const,
  detail: (id: string) => [...exerciseDetailKeys.all, id] as const,
};

export const exercisePreferenceKeys = {
  all: ["exercise-preferences"] as const,
  detail: (exerciseId: string) =>
    [...exercisePreferenceKeys.all, exerciseId] as const,
  batch: (exerciseIds: string[]) =>
    [...exercisePreferenceKeys.all, "batch", ...exerciseIds.sort()] as const,
};

export const statsKeys = {
  all: ["stats"] as const,
  heatmap: () => [...statsKeys.all, "heatmap"] as const,
  volume: (period: string) => [...statsKeys.all, "volume", period] as const,
  prs: () => [...statsKeys.all, "prs"] as const,
  muscleDistribution: (period: string) =>
    [...statsKeys.all, "muscle-distribution", period] as const,
};

export const measurementKeys = {
  all: ["measurements"] as const,
  trend: (field: string, fromDate: string | null) =>
    [...measurementKeys.all, "trend", field, fromDate] as const,
  latest: () => [...measurementKeys.all, "latest"] as const,
  history: (field: string) =>
    [...measurementKeys.all, "history", field] as const,
};
