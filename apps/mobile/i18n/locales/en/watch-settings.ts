export const watchSettings = {
  title: "Apple Watch",
  intro:
    "Start workouts on iPhone, then log sets, manage rest, and view heart rate from your wrist.",
  status: {
    checking: "Checking Apple Watch connection…",
    nonIos: "Apple Watch is available with the iPhone app.",
    notPaired:
      "No Apple Watch paired. Your preferences will be saved for later.",
    notInstalled:
      "Companion not installed. Install Sweaty from the Watch app on iPhone.",
    unreachable: "Installed. Changes will sync when your Watch reconnects.",
    ready: "Connected and ready.",
  },
  helper: {
    queued:
      "Changes are saved on this iPhone and will apply when your Watch is available.",
    unavailable: "Apple Watch preferences can be edited from the iPhone app.",
  },
  sections: {
    restTimer: "Rest timer",
    workoutInteraction: "Workout interaction",
    display: "Display",
  },
  restTimer: {
    warning: {
      label: "Rest ending warning",
      description: "Get a tap before your rest reaches zero.",
      off: "Off",
      five: "5 sec",
      ten: "10 sec",
      fifteen: "15 sec",
      thirty: "30 sec",
      accessibility: "{{label}}, selected {{value}}",
    },
    endHaptics: {
      label: "Vibrate when rest ends",
      description: "Feel a success tap when your rest reaches zero.",
      accessibilityHint: "Controls the success tap at the end of rest.",
    },
    adjustment: {
      label: "Quick adjustment",
      description: "Choose how much the − and + buttons change the timer.",
      ten: "10 sec",
      fifteen: "15 sec",
      thirty: "30 sec",
      accessibility: "{{label}}, selected {{value}}",
    },
    autoShow: {
      label: "Open rest timer after a set",
      description: "Show the countdown automatically after logging a set.",
      accessibilityHint: "Opens the rest countdown after logging a set.",
    },
    completion: {
      label: "When rest ends",
      description: "Choose what happens when the countdown reaches zero.",
      stayOnTimer: "Stay on timer",
      openNextSet: "Open next set",
      accessibility: "{{label}}, selected {{value}}",
    },
  },
  workoutInteraction: {
    setHaptics: {
      label: "Vibrate when a set is logged",
      description: "Get a light tap after logging each set.",
      accessibilityHint: "Controls the light tap after logging a set.",
    },
    skipConfirmation: {
      label: "Confirm before skipping rest",
      description: "Require a second tap before ending a rest early.",
      accessibilityHint: "Requires a second tap before skipping rest.",
    },
    endConfirmation: {
      label: "Confirm before ending workout",
      description: "Require a second tap before finishing the workout.",
      accessibilityHint: "Requires a second tap before ending the workout.",
    },
  },
  display: {
    heartRate: {
      label: "Show live heart rate",
      description: "Show heart rate controls during a Watch workout.",
      accessibilityHint: "Controls heart rate controls during a Watch workout.",
    },
    previousPerformance: {
      label: "Show previous performance",
      description: "Show your last result beside the current set target.",
      accessibilityHint: "Controls the previous performance card.",
    },
  },
} as const;
