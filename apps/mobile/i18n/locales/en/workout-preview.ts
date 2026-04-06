export const workoutPreview = {
  header: {
    back: "Back",
  },
  meta: {
    exercises: "{{count}} exercises",
    duration: "~{{minutes}} min",
    focus: "Focus",
  },
  exerciseList: {
    setsReps: "{{sets}} × {{reps}}",
    setsRepsLoad: "{{sets}} × {{reps}} × {{load}}kg",
    warmup: "Warmup",
    working: "Working",
    swap: "Swap",
    rest: "{{seconds}}s rest",
  },
  edit: {
    toggle: "Edit",
    done: "Done",
    kg: "kg",
    reps: "reps",
  },
  actions: {
    startWorkout: "Start Workout",
    regenerate: "Regenerate",
    regeneratedToday: "Regenerated today",
    regenerating: "Generating...",
    regenerationAvailable: "Available once per plan each day.",
    regenerationUnavailableToday:
      "You already regenerated this plan today. Try again tomorrow.",
  },
  regenerate: {
    confirmTitle: "Generate a new workout?",
    confirmMessage:
      "This will replace the current workout. You can only regenerate once per day.",
    confirm: "Regenerate",
    cancel: "Cancel",
  },
  empty: {
    title: "No workout data",
    subtitle: "This workout is still being generated.",
  },
  status: {
    regeneratingTitle: "Refreshing this plan",
    regeneratingMessage:
      "This workout is being replaced now. The updated version will appear automatically when it is ready.",
  },
} as const;
