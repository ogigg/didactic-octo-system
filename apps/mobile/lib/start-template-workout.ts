import { buildExerciseSets } from "@/lib/exercise-set-structure";
import type { ExercisePreviousSets } from "@/lib/workout-previous-sets";
import type { WorkoutExercise } from "@/stores/workout-store";

export interface TemplateExerciseInput {
  id: string;
  name: string;
}

/** Quick templates remain weight-typed; history is applied per exercise when available. */
export function buildTemplateWorkoutExercises(
  templateExercises: TemplateExerciseInput[],
  options: {
    resolveName: (id: string, fallback: string) => string;
    previousById?: Record<string, ExercisePreviousSets>;
  }
): WorkoutExercise[] {
  return templateExercises.map((ex) => {
    const previous = options.previousById?.[ex.id];
    const built = buildExerciseSets({
      exerciseType: "weight",
      previous,
    });

    return {
      id: ex.id,
      name: options.resolveName(ex.id, ex.name),
      exerciseType: "weight" as const,
      restDurationSeconds: 90,
      notes: "",
      difficultyFeedback: null,
      sets: built.map((set, i) => ({
        ...set,
        id: `set-${ex.id}-${i}-${Date.now()}`,
      })),
    };
  });
}
