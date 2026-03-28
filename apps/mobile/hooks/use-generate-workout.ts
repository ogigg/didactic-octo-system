import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  generateWorkout,
  GenerateWorkoutRequest,
  GenerateWorkoutResponse,
} from "@/lib/api/generate-workout";
import { useWorkoutStore } from "@/stores/workout-store";
import type { WorkoutExercise, WorkoutSet } from "@/stores/workout-store";

function mapResponseToWorkoutExercises(
  response: GenerateWorkoutResponse
): WorkoutExercise[] {
  return response.exercises.map((ex) => ({
    id: ex.exercise_id,
    name: ex.exercise_name,
    restDurationSeconds: ex.rest_duration_seconds,
    notes: ex.notes ?? "",
    sets: ex.sets.map((set, i): WorkoutSet => ({
      id: `set-${ex.exercise_id}-${i}-${Date.now()}`,
      type: set.set_type,
      kg: String(set.target_load_kg),
      reps: String(set.target_reps),
      rpe: null,
      isCompleted: false,
      previousDisplay: null,
    })),
  }));
}

export function useGenerateWorkout() {
  const router = useRouter();
  const startWorkout = useWorkoutStore((s) => s.startWorkout);

  return useMutation({
    mutationFn: (request: GenerateWorkoutRequest) => generateWorkout(request),
    onSuccess: (data) => {
      const exercises = mapResponseToWorkoutExercises(data);
      startWorkout(data.workout_name, exercises);
      router.push("/workout");
    },
  });
}
