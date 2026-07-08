export const streakProtection = {
  eyebrow: "Consistency streak",
  states: {
    none: {
      title: "Your streak is on track",
      body: "Keep going at your pace.",
    },
    at_risk: {
      title: "Your streak is paused",
      body: "Life happens. A short, manageable workout can help you get back into rhythm without forcing it.",
    },
    free_earned_freeze: {
      title: "Protect your consistency streak",
      body: "You earned a streak freeze through consistent training. Use it for the missed week, then ease back in.",
    },
    free_lifetime_rescue: {
      title: "Your streak is paused",
      body: "You can use your one-time restore to keep your consistency streak. No pressure — restarting is always okay too.",
    },
    free_comeback: {
      title: "Let’s get you moving again",
      body: "A missed week does not erase your progress. Start a short comeback challenge or begin a new streak today.",
    },
    pro_auto_applied: {
      title: "Your streak is protected",
      body: "We used 1 Pro freeze for the missed week. You have {{freezes}} remaining.",
    },
    pro_available_freeze: {
      title: "Use a streak freeze?",
      body: "You have a Pro freeze available for the missed week. Use it when you are ready to return.",
    },
    pro_comeback: {
      title: "Ready for a steady return?",
      body: "Your streak can restart today with a workout adjusted for time away.",
    },
  },
  metrics: {
    streakWeeks: "streak weeks",
    freezes: "freezes",
  },
  actions: {
    restoreOnce: "Restore once",
    useFreeze: "Use freeze",
    upgrade: "Upgrade to Pro",
    restart: "Restart streak",
    startComebackWorkout: "Start comeback workout",
    startComebackChallenge: "Start comeback challenge",
    adjustPlan: "Adjust plan",
    notNow: "Not now",
  },
  errors: {
    title: "Couldn’t update streak",
    message: "Please try again in a moment.",
  },
} as const;
