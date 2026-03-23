import { useQuery } from "@tanstack/react-query";

import type { ExerciseFilters } from "@/lib/api/exercises";
import { fetchExercise, fetchExercises } from "@/lib/api/exercises";
import { exerciseKeys } from "@/lib/query-keys";

export function useExercises(filters?: ExerciseFilters) {
  return useQuery({
    queryKey: exerciseKeys.list(filters),
    queryFn: () => fetchExercises(filters),
  });
}

export function useExercise(id: string) {
  return useQuery({
    queryKey: exerciseKeys.detail(id),
    queryFn: () => fetchExercise(id),
    enabled: !!id,
  });
}
