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
      title: "Use your freeze on last week?",
      body: "You earned it by showing up week after week. It fills the gap and your streak stays whole. Or skip it and start fresh — your call.",
    },
    free_lifetime_rescue: {
      title: "Fill the gap from last week?",
      body: "Your one-time restore covers the week you missed and keeps the streak whole. Training this week and starting fresh is just as good.",
    },
    free_comeback: {
      title: "Good to see you",
      body: "Last week was a rest week, so the counter starts over. Everything you’ve logged still stands. A short workout is the easiest way back in.",
    },
    pro_auto_applied: {
      title: "Last week is covered",
      body_one: "A Pro freeze filled the gap for you. {{count}} freeze left.",
      body_other:
        "A Pro freeze filled the gap for you. {{count}} freezes left.",
    },
    pro_available_freeze: {
      title: "Use a freeze on last week?",
      body: "It fills the gap and your streak stays whole. Or skip it and start fresh — your call.",
    },
    pro_comeback: {
      title: "Good to see you",
      body: "No freezes were left for last week, so the counter starts over. Everything you’ve logged still stands. Ease back in, or lighten your plan if the weeks feel too full.",
    },
  },
  details: {
    coveredWeek: "Covers {{range}}",
    freezesAvailable_one: "{{count}} freeze left",
    freezesAvailable_other: "{{count}} freezes left",
    restoreAvailable: "One-time restore, unused",
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
