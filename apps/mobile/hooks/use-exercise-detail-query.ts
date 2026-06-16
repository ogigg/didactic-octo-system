import { useQuery } from "@tanstack/react-query";

import {
  fetchExerciseDetail,
  type ExerciseDetailResponse,
} from "@/lib/api/exercise-detail";
import { exerciseDetailKeys } from "@/lib/query-keys";

export function useExerciseDetail(exerciseId: string): {
  data: ExerciseDetailResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: exerciseDetailKeys.detail(exerciseId),
    queryFn: () => fetchExerciseDetail(exerciseId),
    staleTime: 10 * 60 * 1000,
    enabled: !!exerciseId,
  });

  return { data, isLoading, isError, error, refetch };
}
