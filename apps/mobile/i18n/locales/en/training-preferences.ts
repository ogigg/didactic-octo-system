export const trainingPreferences = {
  header: {
    title: "Training Preferences",
  },
  weightUnit: {
    title: "Weight Unit",
  },
  trainingSplit: {
    title: "Training Split",
    fullBody: "Full Body",
    upperLower: "Upper / Lower",
    pushPullLegs: "Push / Pull / Legs",
    recommended: "Recommended",
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
  prompt: {
    title: "Training Focus",
    subtitle: "Optional — guides all your future workouts",
    placeholder: "e.g., I want to train for a muscle up...",
    charCount: "{{count}}/{{max}}",
  },
  promptSuggestions: {
    trainForMuscleUp: "Train for a muscle up",
    strengthenLowerBack: "Strengthen lower back",
    improveRunningEndurance: "Improve running endurance",
    buildBiggerArms: "Build bigger arms",
  },
  save: {
    button: "Save Preferences",
    saving: "Saving...",
  },
  rebuildWarning: {
    title: "Regenerate Workouts?",
    message:
      "Your upcoming workouts will be replaced based on your new preferences.",
    confirm: "Regenerate All",
    cancel: "Cancel",
  },
  success: "Preferences saved! Your workouts are being regenerated.",
  error: "Failed to save preferences. Please try again.",
} as const;
