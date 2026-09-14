export const onboarding = {
  actions: {
    continue: "Continue",
    save: "Save changes",
    back: "Back",
    edit: "Edit {{field}}",
    create: "Create my workouts",
    saving: "Saving your preferences…",
  },
  progress: {
    step: "Step {{current}} of {{total}}",
    review: "Review your preferences",
  },
  goal: {
    title: "What would you like to achieve?",
    subtitle:
      "We’ll use your goal to plan your workouts. You can change it at any time.",
    build_strength: "Build strength",
    build_muscle: "Build muscle",
    lose_weight: "Lose weight",
    improve_fitness: "Improve fitness",
    custom: "Or describe your own goal",
    invalid:
      "Describe your goal in at least 5 characters, without offensive language.",
  },
  equipment: {
    title: "What equipment do you have available?",
    subtitle:
      "We’ll choose exercises for the equipment you have. Select the option that fits best.",
    bodyweight: "Bodyweight",
    bodyweightHint: "Exercises using your own body weight",
    dumbbells: "Dumbbells",
    dumbbellsHint: "A pair of dumbbells, at home or at the gym",
    barbell: "Barbell",
    barbellHint: "A bar, plates and a rack or bench",
    full_gym: "Gym equipment",
    full_gymHint: "Dumbbells, barbells, machines and cables",
  },
  experience: {
    title: "How much training experience do you have?",
    subtitle:
      "This helps us choose exercises and a starting difficulty that suit you.",
    beginner: "Starting or returning",
    beginnerHint: "New to training or returning after a long break",
    intermediate: "Comfortable with the basics",
    intermediateHint:
      "You train regularly and know how to do the main exercises",
    advanced: "Experienced",
    advancedHint:
      "You follow a training plan and know when to increase the weight or reps",
  },
  frequency: {
    title: "How often would you like to train?",
    subtitle:
      "Choose how many days a week you can train and how much time you have for each workout.",
    days: "Days per week",
    once: "1 day",
    dayCount: "{{count}} days",
    fivePlus: "5+ days",
    fiveHint:
      "You can train five or more days a week. Your first set includes five workouts.",
    duration: "Time per workout",
    minutes: "{{count}} min",
  },
  review: {
    title: "Review your workout preferences",
    subtitle:
      "We’ll prepare your workouts using these choices. Review them below; you can also change them later in your profile.",
    goal: "Goal",
    equipment: "Equipment",
    experience: "Experience",
    schedule: "Schedule",
    scheduleValue: "{{days}} per week · {{minutes}} min per workout",
    split: "Workout structure",
    style: "Training focus",
    adjustStyle: "Change training focus",
    constraints: "Anything we should take into account? (optional)",
    constraintsHint:
      "Tell us about exercises you want to avoid or any movement limitations. Leave this blank if none apply.",
    constraintsPlaceholder: "For example: no jumping exercises",
    constraintsCount: "{{count}}/200",
    strengthLater:
      "You don’t need to know your lifting weights yet. Choose them during your first workout, or add them to your profile later.",
    full_body: "Full body",
    upper_lower: "Separate upper and lower body workouts",
    push_pull_legs: "Separate pushing, pulling and leg workouts",
    strength: "Strength",
    hypertrophy: "Muscle building",
    endurance: "Muscular endurance",
    circuit: "Circuit training",
    error:
      "We couldn’t save your preferences. Check your connection and try again. Your answers are still here.",
  },
} as const;
