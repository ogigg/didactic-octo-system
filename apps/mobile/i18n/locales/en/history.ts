export const history = {
  title: "History",
  empty: {
    title: "No workouts yet",
    subtitle: "Complete your first workout to see it here.",
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
    summary: {
      duration: "Duration",
      volume: "Volume",
      sets: "Sets",
    },
    setFormat: "{{kg}} kg × {{reps}}",
    setFormatNoLog: "—",
    incomplete: "Incomplete",
  },
} as const;
