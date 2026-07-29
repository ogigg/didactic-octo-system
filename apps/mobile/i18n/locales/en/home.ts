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
    reviewTemplate: "Review {{name}}",
  },
  templateDetail: {
    modeLabel: "Review template",
    description:
      "Review the exercises below. This workout will only begin when you choose Start Workout.",
    exercisesTitle: "Exercises",
    startWorkout: "Start Workout",
    activeWorkoutTitle: "Workout already in progress",
    activeWorkoutMessage:
      "Finish or discard your active workout before starting this template.",
    notFoundTitle: "Template not found",
    notFoundMessage:
      "This saved workout is no longer available. Return to My Workouts and choose another template.",
    back: "Back",
  },
  history: {
    seeAll: "See Workout History",
  },
} as const;
