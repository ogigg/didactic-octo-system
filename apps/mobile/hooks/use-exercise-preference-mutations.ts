import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  upsertExercisePreference,
  removeExercisePreference,
  type ExercisePreferenceValue,
} from "@/lib/api/exercise-preferences";
import { exercisePreferenceKeys } from "@/lib/query-keys";

export function useSetExercisePreference() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      exerciseId: string;
      preference: ExercisePreferenceValue;
    }) => upsertExercisePreference(params.exerciseId, params.preference),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: exercisePreferenceKeys.detail(variables.exerciseId),
      });
      queryClient.invalidateQueries({
        queryKey: exercisePreferenceKeys.all,
      });
    },
  });
}

export function useRemoveExercisePreference() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (exerciseId: string) => removeExercisePreference(exerciseId),
    onSuccess: (_data, exerciseId) => {
      queryClient.setQueryData(exercisePreferenceKeys.detail(exerciseId), null);
      queryClient.invalidateQueries({
        queryKey: exercisePreferenceKeys.all,
      });
    },
  });
}
