import { useQuery } from "@tanstack/react-query";
import type { UseQueryOptions } from "@tanstack/react-query";

import type { ExerciseFilters, Exercise } from "@/lib/api/exercises";
import { fetchExercise, fetchExercises } from "@/lib/api/exercises";
import { exerciseKeys } from "@/lib/query-keys";

export function useExercises(
  filters?: ExerciseFilters,
  options?: Omit<UseQueryOptions<Exercise[], Error>, "queryKey" | "queryFn">
) {
  return useQuery({
    queryKey: exerciseKeys.list(filters),
    queryFn: () => fetchExercises(filters),
    ...options,
  });
}

export function useExercise(id: string) {
  return useQuery({
    queryKey: exerciseKeys.detail(id),
    queryFn: () => fetchExercise(id),
    enabled: !!id,
  });
}
