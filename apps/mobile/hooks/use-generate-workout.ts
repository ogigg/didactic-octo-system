import { useMutation } from "@tanstack/react-query";
import { useProfile } from "@/hooks/use-profile-query";
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
import { convertWeight, type WeightUnit } from "@/lib/unit-conversion";
import { trackEvent } from "@/lib/track-event";

export interface StartTrainingRequest {
  preferences: TrainingPreferences;
  request: GenerateWorkoutRequest;
}

function mapResponseToWorkoutExercises(
  response: GenerateWorkoutResponse,
  weightUnit: WeightUnit = "kg"
): WorkoutExercise[] {
  return response.exercises.map((ex) => ({
    id: ex.exercise_id,
    name: ex.exercise_name,
    restDurationSeconds: ex.rest_duration_seconds,
    notes: ex.notes ?? "",
    difficultyFeedback: null,
    exerciseType: ex.exercise_type ?? "weight",
    sets: ex.sets.map(
      (set, i): WorkoutSet => ({
        id: `set-${ex.exercise_id}-${i}-${Date.now()}`,
        type: set.set_type,
        kg:
          set.target_load_kg != null
            ? String(
                Math.round(convertWeight(set.target_load_kg, weightUnit) * 10) /
                  10
              )
            : "",
        reps: set.target_reps != null ? String(set.target_reps) : "",
        durationSeconds: set.target_duration_seconds ?? null,
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
  const { data: profile } = useProfile();
  const weightUnit: WeightUnit = (profile?.weight_unit as WeightUnit) ?? "kg";

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

      const exercises = mapResponseToWorkoutExercises(data, weightUnit);
      startWorkout(data.workout_name, exercises);
      router.push("/workout");
    },
  });
}
