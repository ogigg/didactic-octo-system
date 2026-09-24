export const strengthBaselines = {
  exercises: {
    pushups: "Push-ups",
    pullups: "Pull-ups / Chin-ups",
    db_bench: "Dumbbell bench press",
    db_row: "Dumbbell row",
    bb_bench: "Barbell bench press",
    bb_squat: "Barbell squat",
    deadlift: "Deadlift",
  },
  form: {
    guidance:
      "Use a recent comfortable working set, not a maximum attempt. For dumbbells, enter the weight of one dumbbell; for barbells, include the bar. Leave unknown exercises blank. Enter 0 reps if you cannot do a bodyweight exercise yet.",
    reps: "Reps",
    loadLabel: "{{exercise}} weight in {{unit}}",
    repsLabel: "{{exercise}} repetitions",
    pairError:
      "Enter a non-negative weight and 1–999 whole repetitions, or clear both fields.",
    repsError: "Enter 0–999 whole repetitions, or leave blank.",
  },

  header: {
    title: "My Strength Levels",
  },
  subtitle: "These help the AI pick the right weights for you.",
  skipHint: "Leave any blank to skip — the AI will estimate conservatively.",
  save: {
    button: "Save",
    saving: "Saving...",
  },
  success: "Strength levels updated!",
  retry: "Try again",
  error: "Failed to save. Please try again.",
} as const;
