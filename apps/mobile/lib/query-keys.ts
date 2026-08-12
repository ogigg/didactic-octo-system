import type { ExerciseFilters } from "@/lib/api/exercises";

export const profileKeys = {
  all: ["profiles"] as const,
  detail: (userId: string) => [...profileKeys.all, userId] as const,
};

export const exerciseKeys = {
  all: ["exercises"] as const,
  list: (filters?: ExerciseFilters, language = "en") =>
    [...exerciseKeys.all, "list", language, filters ?? {}] as const,
  detail: (id: string, language = "en") =>
    [...exerciseKeys.all, "detail", language, id] as const,
  labels: (language = "en") =>
    [...exerciseKeys.all, "labels", language] as const,
  filterOptions: (language = "en") =>
    [...exerciseKeys.all, "filter-options", language] as const,
};

export const workoutKeys = {
  all: ["workouts"] as const,
  list: (language = "en") => [...workoutKeys.all, "list", language] as const,
  forDay: (dateKey: string) => [...workoutKeys.all, "forDay", dateKey] as const,
  detail: (id: string, language = "en") =>
    [...workoutKeys.all, "detail", language, id] as const,
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
  list: () => [...exercisePreferenceKeys.all, "list"] as const,
  detail: (exerciseId: string) =>
    [...exercisePreferenceKeys.all, exerciseId] as const,
  batch: (exerciseIds: string[]) =>
    [...exercisePreferenceKeys.all, "batch", ...exerciseIds.sort()] as const,
};

export const statsKeys = {
  all: ["stats"] as const,
  heatmap: () => [...statsKeys.all, "heatmap"] as const,
  volume: (period: string) => [...statsKeys.all, "volume", period] as const,
  prs: (language = "en") => [...statsKeys.all, "prs", language] as const,
  muscleDistribution: (period: string, language = "en") =>
    [...statsKeys.all, "muscle-distribution", period, language] as const,
};

export const measurementKeys = {
  all: ["measurements"] as const,
  trend: (field: string, fromDate: string | null) =>
    [...measurementKeys.all, "trend", field, fromDate] as const,
  latest: () => [...measurementKeys.all, "latest"] as const,
  history: (field: string) =>
    [...measurementKeys.all, "history", field] as const,
};

export const workoutSessionCommentKeys = {
  all: ["workout-session-comments"] as const,
  recent: (userId: string, limit: number) =>
    [...workoutSessionCommentKeys.all, "recent", userId, limit] as const,
  forSession: (sessionId: string) =>
    [...workoutSessionCommentKeys.all, "forSession", sessionId] as const,
};

export const subscriptionKeys = {
  all: ["subscription"] as const,
  usage: () => [...subscriptionKeys.all, "usage"] as const,
};

export const streakProtectionKeys = {
  all: ["streak-protection"] as const,
  status: (userId: string) =>
    [...streakProtectionKeys.all, "status", userId] as const,
};
