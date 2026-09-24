import type { Exercise } from "@/lib/api/exercises";

/**
 * The exercise's first primary muscle in the catalog language, falling back to
 * the raw muscle key when the catalog has no label for it.
 */
export function getPrimaryMuscleLabel(
  exercise:
    | Pick<Exercise, "primary_muscles" | "primary_muscle_labels">
    | undefined
): string | null {
  // `||` so a blank label still falls back to the muscle key.
  return (
    exercise?.primary_muscle_labels[0] || exercise?.primary_muscles[0] || null
  );
}
