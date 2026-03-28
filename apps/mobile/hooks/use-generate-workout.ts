import { useMutation } from "@tanstack/react-query";

import type {
  GenerateWorkoutRequest,
  GenerateWorkoutResponse,
} from "@/lib/api/ai-workout";
import { generateWorkout } from "@/lib/api/ai-workout";

export function useGenerateWorkout() {
  return useMutation<GenerateWorkoutResponse, Error, GenerateWorkoutRequest>({
    mutationFn: generateWorkout,
  });
}
