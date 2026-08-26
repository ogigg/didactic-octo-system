import { useProfile } from "@/hooks/use-profile-query";
import {
  generateWorkout,
  GenerateWorkoutRequest,
  GenerateWorkoutResponse,
} from "@/lib/api/generate-workout";
import {
  TrainingPreferences,
  updateTrainingPreferences,
} from "@/lib/api/profiles";
import { fetchPreviousSetDisplays } from "@/lib/api/workouts";
import {
  applyPreviousSetsToWorkoutSets,
  normalizeGeneratedExerciseSets,
} from "@/lib/exercise-set-structure";
import { trackEvent } from "@/lib/track-event";
import { normalizeAnalyticsError } from "@/lib/analytics-errors";
import { convertWeight, type WeightUnit } from "@/lib/unit-conversion";
import {
  convertPreviousDisplay,
  type ExercisePreviousSets,
} from "@/lib/workout-previous-sets";
import type {
  GenerationMeta,
  WorkoutExercise,
  WorkoutSet,
} from "@/stores/workout-store";
import { useWorkoutStore } from "@/stores/workout-store";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as Crypto from "expo-crypto";

export interface StartTrainingRequest {
  preferences: TrainingPreferences;
  request: GenerateWorkoutRequest;
}

function mapResponseToWorkoutExercises(
  response: GenerateWorkoutResponse,
  weightUnit: WeightUnit = "kg",
  previousSetDisplays: Record<string, ExercisePreviousSets> = {}
): WorkoutExercise[] {
  return response.exercises.map((ex) => {
    const exerciseType = ex.exercise_type ?? "weight";
    const fallbackPreviousDisplay = convertPreviousDisplay(
      ex.previous_display,
      weightUnit
    );
    const normalizedSets = normalizeGeneratedExerciseSets(
      exerciseType,
      ex.sets
    );
    const sets = applyPreviousSetsToWorkoutSets(
      normalizedSets.map(
        (set, i): WorkoutSet => ({
          id: `set-${ex.exercise_id}-${i}-${Date.now()}`,
          type: set.set_type,
          kg:
            set.target_load_kg != null
              ? String(
                  Math.round(
                    convertWeight(set.target_load_kg, weightUnit) * 10
                  ) / 10
                )
              : "",
          reps: set.target_reps != null ? String(set.target_reps) : "",
          durationSeconds: set.target_duration_seconds ?? null,
          rpe: null,
          isCompleted: false,
          previousDisplay: null,
        })
      ),
      previousSetDisplays[ex.exercise_id],
      fallbackPreviousDisplay
    );

    return {
      id: ex.exercise_id,
      name: ex.exercise_name,
      image: ex.image ?? null,
      restDurationSeconds: ex.rest_duration_seconds,
      notes: ex.notes ?? "",
      reasoning: ex.reasoning ?? null,
      difficultyFeedback: null,
      exerciseType,
      sets,
    };
  });
}

export function useGenerateWorkout() {
  const router = useRouter();
  const startWorkout = useWorkoutStore((s) => s.startWorkout);
  const { data: profile } = useProfile();
  const weightUnit: WeightUnit = (profile?.weight_unit as WeightUnit) ?? "kg";

  return useMutation({
    mutationFn: async ({ preferences, request }: StartTrainingRequest) => {
      const requestId = Crypto.randomUUID();
      const startedAt = Date.now();
      trackEvent("workout_generation_requested", {
        request_id: requestId,
        trigger: "immediate",
      });

      try {
        await updateTrainingPreferences(preferences);
      } catch (error) {
        // The Edge Function is the canonical source for generation lifecycle
        // events. Only failures before invoking it are captured on-device.
        trackEvent("workout_generation_client_failed", {
          request_id: requestId,
          ...normalizeAnalyticsError(error),
          failure_stage: "preferences_update",
        });
        throw error;
      }

      let response: GenerateWorkoutResponse;
      try {
        response = await generateWorkout({
          ...request,
          request_id: requestId,
        });
      } catch (error) {
        // Keep transport/client failures separate from the canonical server
        // lifecycle events. If the function did run, its server event remains
        // authoritative; this event is only for the client-observed failure.
        trackEvent("workout_generation_client_failed", {
          request_id: requestId,
          ...normalizeAnalyticsError(error),
          failure_stage: "function_transport",
        });
        throw error;
      }
      // Keep this legacy client event for immediate-generation attribution;
      // canonical started/completed/failed events come from the Edge Function.
      trackEvent("workout_generated", {
        request_id: requestId,
        generation_source: response.generation_source,
        generation_time_ms: Math.max(0, Date.now() - startedAt),
        exercise_count: response.exercises.length,
      });
      return { response, requestId };
    },
    onSuccess: async ({ response: data }) => {
      const previousSetDisplays: Record<string, ExercisePreviousSets> =
        await fetchPreviousSetDisplays(
          data.exercises.map((ex) => ex.exercise_id),
          weightUnit
        ).catch(() => ({}));
      const exercises = mapResponseToWorkoutExercises(
        data,
        weightUnit,
        previousSetDisplays
      );
      const generationMeta: GenerationMeta = {
        generationSource: data.generation_source,
        goalSnapshot: data.goal_snapshot,
        customGoalSnapshot: data.custom_goal_snapshot,
        reasoning: data.reasoning ?? null,
      };

      const warmup = data.warmup
        ? {
            durationSeconds: data.warmup.duration_seconds,
            isCompleted: false,
          }
        : null;

      startWorkout(data.workout_name, exercises, generationMeta, warmup, {
        workoutSource: "queued_ai",
      });
      router.push("/workout");
    },
  });
}
