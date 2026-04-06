export const exerciseDetail = {
  tabs: {
    overview: "Overview",
    history: "History",
    howTo: "How To",
  },
  overview: {
    records: "Personal Records",
    recordsHint: "Peak lifts, cleanly tracked.",
    sessionsCount: "{{count}} sessions",
    maxWeight: "Max Weight",
    maxReps: "Max Reps",
    bestSet: "Best Set",
    est1rm: "Est. 1RM",
    maxRpe: "Max RPE",
    volume: "Volume Over Time",
    achievedOn: "Hit on {{date}}",
    noDate: "Date unavailable",
    noData: "Complete workouts with this exercise to see stats.",
  },
  history: {
    noSessions: "No sessions recorded yet.",
    set: "Set {{number}}",
    completedSets: "{{count}} completed sets",
  },
  howTo: {
    instructions: "Instructions",
    noInstructions:
      "Instructions for this exercise are not available yet. Check back soon!",
    todo: "Detailed technique guides coming soon.",
  },
  muscles: {
    primary: "Primary",
    secondary: "Secondary",
  },
} as const;
