export const workoutPreview = {
  header: {
    back: "Back",
  },
  meta: {
    exercises: "{{count}} exercises",
    duration: "~{{minutes}} min",
    focus: "Focus",
  },
  warmup: {
    title: "Warmup",
    timer: "{{time}} timer",
  },
  exerciseList: {
    setsReps: "{{sets}} × {{reps}}",
    setsRepsLoad: "{{sets}} × {{reps}} × {{load}}",
    warmup: "Warmup",
    working: "Working",
    swap: "Swap",
    rest: "{{seconds}}s rest",
  },
  reasoning: {
    planTitle: "Why this plan",
    exerciseTitle: "Why this exercise",
    show: "Show",
    hide: "Hide",
    muscleGroups: "Muscle groups",
    trainingStrategy: "Training strategy",
    exerciseSelection: "Exercise choice",
    progressionAdjustment: "Progression adjustment",
    progression: {
      staleHistoryHold:
        "Targets were held because the available performance history is stale.",
      staleHistoryDeload:
        "Targets were reduced conservatively because the available performance history is stale.",
      feedbackTooHardHold:
        "Targets were held because the previous session was rated too hard.",
      feedbackTooHardDeload:
        "Targets were reduced conservatively because the previous session was rated too hard.",
      highRpeHold:
        "Targets were held because a recent working set reached RPE 9 or higher.",
      highRpeDeload:
        "Targets were reduced conservatively because a recent working set reached RPE 9 or higher.",
      feedbackConflictHold:
        "Targets were held because easy feedback conflicted with a recent RPE of 9 or higher.",
      feedbackConflictDeload:
        "Targets were reduced conservatively because easy feedback conflicted with a recent RPE of 9 or higher.",
      feedbackTooEasy:
        "Targets increased because the previous session was rated too easy.",
      repRangeIncrease:
        "Repetitions increased within the configured training range.",
      weightIncrement: "Load increased by the configured equipment increment.",
      timeIncrement: "Duration increased by the configured time increment.",
    },
    planAccessibility: "Show workout reasoning",
    exerciseAccessibility: "Show reasoning for {{exerciseName}}",
  },
  edit: {
    toggle: "Edit",
    done: "Done",
    kg: "{{unit}}",
    reps: "reps",
  },
  setHeader: {
    set: "SET",
    type: "TYPE",
    reps: "REPS",
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
    confirmWithFeedback: "Regenerate with feedback",
    cancel: "Cancel",
    dismiss: "Close regeneration feedback",
    sheetTitle: "What should change?",
    sheetMessage:
      "Add a short note for the next version, or skip feedback to refresh the plan as-is.",
    feedbackPlaceholder:
      "Example: less lower back work, keep bench press, make it shorter...",
    feedbackAccessibilityLabel: "Regeneration feedback",
    feedbackCount: "{{count}}/{{max}}",
    skipFeedback: "Skip feedback",
    limitNote:
      "Regeneration replaces this workout and is available once per day.",
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
