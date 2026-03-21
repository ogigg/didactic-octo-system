export const workout = {
  topBar: {
    finish: "Finish",
  },
  timer: {
    elapsed: "Elapsed",
  },
  exercise: {
    notesPlaceholder: "Add notes here...",
    restTimer: "Rest Timer: {{time}}",
    addSet: "+ Add Set",
    removeSet: "Remove set",
  },
  setHeader: {
    set: "SET",
    previous: "PREVIOUS",
    kg: "KG",
    reps: "REPS",
    rpe: "RPE",
    done: "\u2713",
  },
  rpe: {
    title: "Rate of Perceived Exertion",
    select: "Select RPE",
  },
  menu: {
    reorder: "Reorder Exercise",
    replace: "Replace Exercise",
    remove: "Remove Exercise",
    notImplemented: "This feature will be available soon.",
  },
  restTimerBar: {
    skip: "Skip",
    adjustDown: "-15s",
    adjustUp: "+15s",
  },
  miniBar: {
    resume: "Tap to resume workout",
  },
  summary: {
    title: "Workout Complete",
    returnHome: "Return Home",
  },
} as const;
