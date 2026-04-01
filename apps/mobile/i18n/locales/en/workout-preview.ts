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
} as const;
