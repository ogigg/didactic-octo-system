import { useQuery } from "@tanstack/react-query";

import {
  fetchExercisePreference,
  fetchExercisePreferences,
} from "@/lib/api/exercise-preferences";
import { exercisePreferenceKeys } from "@/lib/query-keys";

export function useExercisePreference(exerciseId: string) {
  return useQuery({
    queryKey: exercisePreferenceKeys.detail(exerciseId),
    queryFn: () => fetchExercisePreference(exerciseId),
    enabled: !!exerciseId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useExercisePreferences(exerciseIds?: string[]) {
  return useQuery({
    queryKey:
      exerciseIds === undefined
        ? exercisePreferenceKeys.list()
        : exercisePreferenceKeys.batch(exerciseIds),
    queryFn: () => fetchExercisePreferences(exerciseIds),
    enabled: exerciseIds === undefined || exerciseIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
