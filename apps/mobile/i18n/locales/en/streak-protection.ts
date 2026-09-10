export const streakProtection = {
  eyebrow: "Consistency streak",
  closeSheet: "Close streak options",
  states: {
    none: {
      title: "Your streak is on track",
      body: "Keep going at your pace.",
    },
    at_risk: {
      title: "Your {{count}}-week streak is still going",
      body: "A workout on any day this week keeps it going. Short sessions count too.",
    },
    free_earned_freeze: {
      title: "Cover last week with your freeze?",
      body: "You earned this freeze through consistent training. Using it marks last week as covered, so your streak carries on. Skipping it is fine too — any workout this week starts a fresh count.",
    },
    free_lifetime_rescue: {
      title: "Keep your streak going?",
      body: "Last week didn’t include a workout. Your one-time restore covers it, so your streak carries on. Or simply train this week and start a fresh count — both are good options.",
    },
    free_comeback: {
      title: "Welcome back",
      body: "Last week didn’t include a workout, so your streak count begins again. Your history and progress are untouched. A short comeback workout is the easiest way to get moving.",
    },
    pro_auto_applied: {
      title: "Last week is covered",
      body_one:
        "A Pro freeze was applied automatically, so your streak carries on. You have {{count}} freeze left.",
      body_other:
        "A Pro freeze was applied automatically, so your streak carries on. You have {{count}} freezes left.",
    },
    pro_available_freeze: {
      title: "Cover last week with a freeze?",
      body: "Last week didn’t include a workout. A Pro freeze covers it, so your streak carries on. Skipping it is fine too — any workout this week starts a fresh count.",
    },
    pro_comeback: {
      title: "Welcome back",
      body: "Last week didn’t include a workout and no freezes were left, so your streak count begins again. Your history is untouched. Start with a workout adjusted for time away, or adjust your plan if the week was too full.",
    },
  },
  details: {
    coveredWeek: "Week to cover: {{range}}",
    freezesAvailable_one: "{{count}} freeze available",
    freezesAvailable_other: "{{count}} freezes available",
    restoreAvailable: "One-time restore available",
  },
  actions: {
    useFreeze: "Use freeze",
    useRestore: "Use one-time restore",
    startWorkoutInstead: "Start a workout instead",
    startComebackWorkout: "Start comeback workout",
    startWorkout: "Start a workout",
    adjustPlan: "Adjust my plan",
    startFresh: "Start a new streak",
    notNow: "Not now",
    gotIt: "Got it",
  },
  pro: {
    hint: "Pro includes monthly streak freezes.",
    link: "Learn about Pro",
  },
  restartConfirm: {
    title: "Start a new streak?",
    body: "Your streak count starts again from your next workout. Your workout history stays exactly as it is.",
    confirm: "Yes, start fresh",
    cancel: "Back",
  },
  feedback: {
    protectionApplied: "Last week is covered. Your streak carries on.",
    restarted: "Fresh start — your streak begins with your next workout.",
  },
  errors: {
    actionFailed:
      "Couldn’t update your streak. Your workouts are safe — please try again.",
  },
} as const;
