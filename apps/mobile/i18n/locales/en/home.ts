export const home = {
  welcome: "Welcome!",
  step1: {
    title: "Step 1: Try it",
    description:
      "Edit <bold>app/(tabs)/index.tsx</bold> to see changes. Press <bold>{{shortcut}}</bold> to open developer tools.",
  },
  step2: {
    title: "Step 2: Explore",
    description:
      "Tap the Explore tab to learn more about what's included in this starter app.",
  },
  step3: {
    title: "Step 3: Get a fresh start",
    description:
      "When you're ready, run <bold>npm run reset-project</bold> to get a fresh <bold>app</bold> directory. This will move the current <bold>app</bold> to <bold>app-example</bold>.",
  },
  menu: {
    more: "More",
  },
  greeting: {
    morning: "Good morning",
    afternoon: "Good afternoon",
    evening: "Good evening",
    subtitle: "Ready to train?",
  },
  weeklyProgress: {
    title: "This Week",
    completed_one: "{{count}} workout done",
    completed_other: "{{count}} workouts done",
  },
  workoutQueue: {
    title: "Your Plan",
    readyCount: "{{ready}}/{{total}}",
    empty: "No workouts queued yet",
    emptySubtitle: "Complete onboarding to get your personalized plan",
    emptyReady: "Your workouts will appear here",
    emptyReadySubtitle: "Generate your first AI workout to get started",
    generate: "Generate AI Workout",
  },
  queueCard: {
    dayLabel: "Day {{position}}",
    startWorkout: "Start Workout",
    resumeWorkout: "Resume Workout",
    generating: "Preparing your workout...",
    regenerating: "Refreshing workout",
    regeneratingSubtitle: "Your replacement workout is on the way.",
    regenerationUnavailableToday:
      "Already refreshed today. You can regenerate this plan again tomorrow.",
    queued: "Up next",
    failed: "Couldn't generate",
    tryAgain: "Try Again",
    recovery: {
      accessibilityLabel: "Workout day {{position}} needs recovery",
      retryTitle: "Your workout needs another try",
      retryDescription:
        "Your setup is saved. Try again without restarting onboarding. Attempt {{next}} of {{max}}.",
      fallbackTitle: "We couldn't recover this workout",
      fallbackDescription:
        "Use a dependable fallback plan now, or contact support with the reference below.",
      useFallback: "Use Fallback Workout",
      contactSupport: "Contact Support",
      reference: "Support reference: {{reference}}",
      fallbackErrorTitle: "Fallback unavailable",
      fallbackErrorDescription:
        "We couldn't apply the fallback workout. Try again or contact support with the reference shown.",
      fallbackWorkout: {
        focusAreas: {
          push: "Push",
          pull: "Pull",
          legs: "Legs",
          upper: "Upper Body",
          lower: "Lower Body",
          full_body: "Full Body",
        },
        name: "{{focusArea}} Recovery",
        muscleGroups:
          "This recovery plan keeps attention on {{focusArea}} so your weekly queue stays usable.",
        trainingStrategy:
          "It uses familiar movements with conservative targets after repeated generation attempts.",
        notes: "Fallback template used after repeated generation attempts.",
        exerciseMuscles:
          "{{exerciseName}} targets {{muscles}} for this {{focusArea}} session.",
        exerciseSelection:
          "Selected from the available exercise catalog as a dependable fallback option.",
      },
    },
    completed: "Done",
    exerciseCount: "+{{count}} more",
    duration: "{{minutes}} min",
    setsAndReps: "{{sets}}×{{reps}}",
  },
  myWorkouts: {
    title: "My Workouts",
    create: "Create Workout",
    exerciseCount_one: "{{count}} exercise",
    exerciseCount_other: "{{count}} exercises",
    empty: "Create your first custom workout",
    newWorkoutName: "New Workout",
  },
  history: {
    seeAll: "See Workout History",
  },
} as const;
