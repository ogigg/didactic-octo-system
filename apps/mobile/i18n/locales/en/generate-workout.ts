export const generateWorkout = {
  title: "Generate Workout",
  focusArea: {
    label: "Focus Area",
    push: "Push",
    pull: "Pull",
    legs: "Legs",
    upper: "Upper",
    lower: "Lower",
    fullBody: "Full Body",
  },
  duration: {
    label: "Duration",
    minutes: "{{count}} min",
  },
  generate: "Generate Workout",
  generating: "Crafting your workout...",
  result: {
    startWorkout: "Start Workout",
    regenerate: "Regenerate",
    sets: "sets",
    reps: "reps",
    warmup: "Warmup",
    working: "Working",
    rest: "{{seconds}}s rest",
  },
  error: {
    failed: "Failed to generate workout. Please try again.",
    rateLimited: "Please wait {{seconds}}s before generating again.",
    noExercises: "No exercises found for this focus area.",
  },
} as const;
