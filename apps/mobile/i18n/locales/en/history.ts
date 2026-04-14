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
  },
} as const;
