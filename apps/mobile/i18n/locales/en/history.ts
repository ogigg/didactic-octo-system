export const history = {
  header: {
    back: "Back",
  },
  title: "History",
  dayTitle: "Workouts on {{date}}",
  empty: {
    title: "No workouts yet",
    subtitle: "Complete your first workout to see it here.",
    dayTitle: "No workouts this day",
    daySubtitle: "Pick another day on the calendar.",
  },
  card: {
    duration: "Duration",
    volume: "Volume",
    sets: "Sets",
    moreExercises: "+{{count}} more",
  },
  detail: {
    fallbackName: "Workout",
    muscleDistribution: "Muscle Distribution",
    noMuscleData: "No muscle data available",
    heartRate: {
      title: "Heart Rate",
      unit: "bpm",
      avg: "Avg",
      min: "Min",
      max: "Max",
    },
    summary: {
      duration: "Duration",
      volume: "Volume",
      sets: "Sets",
    },
    setFormat: "{{weight}} × {{reps}}",
    setFormatNoLog: "—",
    incomplete: "Incomplete",
    comments: {
      title: "Your notes",
    },
    deleteExercise: {
      accessibilityLabel: "Remove {{exerciseName}} from this workout",
      confirmTitle: "Remove exercise?",
      confirmMessage:
        "This permanently removes {{exerciseName}} and its logged sets from your history. It will no longer affect your statistics or future workouts.",
      cancel: "Cancel",
      remove: "Remove",
      errorTitle: "Could not remove exercise",
      errorMessage: "Try again in a moment.",
    },
    deleteWorkout: {
      accessibilityLabel: "Delete this workout",
      button: "Delete workout permanently",
      deleting: "Deleting workout…",
      confirmTitle: "Delete workout?",
      confirmMessage:
        "“{{workoutName}}” from {{workoutDate}} and all its logged data will be permanently deleted. It will no longer appear in history or affect statistics and future workouts.",
      unknownDate: "an unknown date",
      cancel: "Cancel",
      remove: "Delete permanently",
      success: "Workout deleted from your history.",
      errorTitle: "Could not delete workout",
      errorMessage: "Try again in a moment.",
    },
  },
} as const;
