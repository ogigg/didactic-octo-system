export const workout = {
  topBar: {
    finish: "Finish",
    progress: "{{completed}}/{{total}} sets",
  },
  timer: {
    elapsed: "Elapsed",
  },
  exercise: {
    notesPlaceholder: "Add notes here...",
    restTimer: "Rest Timer: {{time}}",
    addSet: "+ Add Set",
    removeSet: "Remove set",
    fillFromPrevious: "Fill from previous",
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
  keyboard: {
    next: "Next",
    done: "Done",
  },
  finish: {
    confirmTitle: "Finish Workout?",
    confirmMessage: "You have {{count}} incomplete set remaining.",
    confirmMessage_plural: "You have {{count}} incomplete sets remaining.",
    confirmFinish: "Finish Anyway",
    cancel: "Keep Going",
  },
  emptyState: {
    title: "No exercises yet",
    subtitle: "Add exercises to build your workout",
    addExercise: "Add Exercise",
  },
  addExercise: "Add Exercise",
  editName: {
    placeholder: "Workout Name",
  },
  saveTemplate: {
    title: "Save as Template?",
    message: "Save this workout so you can use it again.",
    save: "Save Template",
    saved: "Saved",
    skip: "Skip",
  },
} as const;
