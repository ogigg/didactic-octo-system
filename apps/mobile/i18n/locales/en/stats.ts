export const stats = {
  title: "Statistics",
  sections: {
    activity: "Workout Activity",
    muscles: "Muscle Distribution",
    volume: "Volume Over Time",
    records: "Personal Records",
  },
  heatmap: {
    workoutsThisYear: "{{count}} workouts this year",
    streak: "{{count}}-week streak",
    less: "Less",
    more: "More",
  },
  volume: {
    total: "Total",
    weeklyAvg: "Weekly avg",
    perWeek: "/wk",
    unitTonnes: "t",
    unitKg: "kg",
  },
  periods: {
    "30d": "30d",
    "90d": "90d",
    "1y": "1Y",
    all: "All",
  },
  records: {
    heaviest: "Heaviest",
    heaviestReps: "{{reps}} reps",
    mostReps: "Most Reps",
    mostRepsWeight: "@ {{weight}}",
    bestSet: "Best Set",
    est1rm: "Est. 1RM",
    searchPlaceholder: "Search exercises...",
    empty: "Complete workouts to see your records",
    noResults: "No exercises match your search",
  },
  empty: {
    title: "No data yet",
    subtitle: "Complete your first workout to see stats here",
  },
} as const;
