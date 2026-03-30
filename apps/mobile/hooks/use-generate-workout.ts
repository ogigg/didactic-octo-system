import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  generateWorkout,
  GenerateWorkoutRequest,
  GenerateWorkoutResponse,
} from "@/lib/api/generate-workout";
import {
  updateTrainingPreferences,
  TrainingPreferences,
} from "@/lib/api/profiles";
import { useWorkoutStore } from "@/stores/workout-store";
import type { WorkoutExercise, WorkoutSet } from "@/stores/workout-store";
import { trackEvent } from "@/lib/track-event";

export interface StartTrainingRequest {
  preferences: TrainingPreferences;
  request: GenerateWorkoutRequest;
}

function mapResponseToWorkoutExercises(
  response: GenerateWorkoutResponse
): WorkoutExercise[] {
  return response.exercises.map((ex) => ({
    id: ex.exercise_id,
    name: ex.exercise_name,
    restDurationSeconds: ex.rest_duration_seconds,
    notes: ex.notes ?? "",
    sets: ex.sets.map(
      (set, i): WorkoutSet => ({
        id: `set-${ex.exercise_id}-${i}-${Date.now()}`,
        type: set.set_type,
        kg: String(set.target_load_kg),
        reps: String(set.target_reps),
        rpe: null,
        isCompleted: false,
        previousDisplay: null,
      })
    ),
  }));
}

export function useGenerateWorkout() {
  const router = useRouter();
  const startWorkout = useWorkoutStore((s) => s.startWorkout);

  return useMutation({
    mutationFn: async ({ preferences, request }: StartTrainingRequest) => {
      await updateTrainingPreferences(preferences);
      return generateWorkout(request);
    },
    onSuccess: (data, variables) => {
      // Track workout generation event
      trackEvent("workout_generated", {
        generation_source: data.generation_source,
        training_split: variables.request.training_split,
        duration_minutes: variables.request.duration_minutes,
        equipment: variables.request.equipment,
        training_style: variables.request.training_style,
        difficulty: variables.request.difficulty,
        exercise_count: data.exercises.length,
        has_custom_prompt: !!variables.request.custom_prompt,
      });

      const exercises = mapResponseToWorkoutExercises(data);
      startWorkout(data.workout_name, exercises);
      router.push("/workout");
    },
  });
}
