export const streakProtection = {
  eyebrow: "Weekly streak",
  closeSheet: "Close streak options",
  states: {
    none: {
      title: "Streak on track",
      body: "Keep going at your own pace.",
    },
    at_risk: {
      title: "Still on a {{count}}-week streak",
      body: "One workout this week keeps it. Anything counts.",
    },
    free_earned_freeze: {
      title: "Missed a week? Keep your streak",
      body: "Your training earned you a freeze. Use it to cover last week and keep your streak, or start a new streak with your next workout.",
    },
    free_lifetime_rescue: {
      title: "Give your streak another week",
      body: "Missed last week? Use your one-time restore to keep your streak, or start a new streak with your next workout.",
    },
    free_comeback: {
      title: "Ready for your next workout?",
      body: "Your next workout starts a new streak. Your past workouts are all saved. Pick up where you left off, even if today’s session is a short one.",
    },
    pro_auto_applied: {
      title: "Your streak is safe",
      body_one:
        "Pro used a freeze to keep your streak going through last week. {{count}} freeze left.",
      body_other:
        "Pro used a freeze to keep your streak going through last week. {{count}} freezes left.",
    },
    pro_available_freeze: {
      title: "Keep your streak going",
      body: "Use a freeze to cover last week and keep your streak, or start a new streak with your next workout.",
    },
    pro_comeback: {
      title: "Ready for your next workout?",
      body: "You had no freezes left to cover last week. Your next workout starts a new streak, and your past workouts are all saved. Need a lighter schedule? Adjust your plan below.",
    },
  },
  details: {
    coveredWeek: "Covers {{range}}",
    freezesAvailable_one: "{{count}} freeze left",
    freezesAvailable_other: "{{count}} freezes left",
    restoreAvailable: "One-time restore available",
  },
  actions: {
    useFreeze: "Use freeze",
    useRestore: "Use restore",
    startWorkoutInstead: "Train instead",
    startComebackWorkout: "Start a workout",
    startWorkout: "Start a workout",
    adjustPlan: "Adjust my plan",
    startFresh: "Start over",
    notNow: "Not now",
    gotIt: "Got it",
  },
  pro: {
    hint: "Pro members get a freeze every month.",
    link: "See Pro",
  },
  restartConfirm: {
    title: "Start over?",
    body: "The counter goes back to zero and climbs from your next workout. Everything you’ve logged stays.",
    confirm: "Start over",
    cancel: "Back",
  },
  feedback: {
    protectionApplied: "Gap filled. Streak intact.",
    restarted: "Fresh start. It counts from your next workout.",
  },
  errors: {
    actionFailed:
      "That didn’t go through. Your workouts are unaffected — try again.",
  },
} as const;
