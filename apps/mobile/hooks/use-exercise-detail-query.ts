import { useQuery } from "@tanstack/react-query";

import {
  fetchExerciseDetail,
  type ExerciseDetailResponse,
} from "@/lib/api/exercise-detail";
import { exerciseDetailKeys } from "@/lib/query-keys";

export function useExerciseDetail(exerciseId: string): {
  data: ExerciseDetailResponse | undefined;
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery({
    queryKey: exerciseDetailKeys.detail(exerciseId),
    queryFn: () => fetchExerciseDetail(exerciseId),
    staleTime: 10 * 60 * 1000,
    enabled: !!exerciseId,
  });

  return { data, isLoading };
}
