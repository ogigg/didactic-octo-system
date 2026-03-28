export const generateWorkout = {
  header: {
    title: "Generate Workout",
    back: "Back",
  },
  prompt: {
    title: "Describe Your Goal",
    subtitle: "Optional — the AI will tailor your workout",
    placeholder: "e.g., I want to train for a muscle up...",
    charCount: "{{count}}/{{max}}",
  },
  focusArea: {
    title: "Focus Area",
    push: "Push",
    pull: "Pull",
    legs: "Legs",
    upper: "Upper Body",
    lower: "Lower Body",
    fullBody: "Full Body",
  },
  duration: {
    title: "Duration",
    min15: "15 min",
    min30: "30 min",
    min45: "45 min",
    min60: "60 min",
    min90: "90 min",
  },
  equipment: {
    title: "Equipment",
    bodyweight: "Bodyweight",
    dumbbells: "Dumbbells",
    barbell: "Barbell",
    fullGym: "Full Gym",
  },
  trainingStyle: {
    title: "Training Style",
    strength: "Strength",
    hypertrophy: "Hypertrophy",
    endurance: "Endurance",
    circuit: "Circuit",
  },
  difficulty: {
    title: "Difficulty",
    beginner: "Beginner",
    intermediate: "Intermediate",
    advanced: "Advanced",
  },
  generate: {
    button: "Generate Workout",
    loading: "Generating...",
    error: "Failed to generate workout. Please try again.",
  },
} as const;
