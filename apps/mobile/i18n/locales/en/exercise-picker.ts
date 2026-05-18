export const exercisePicker = {
  header: {
    titleReplace: "Replace Exercise",
    titleAdd: "Add Exercise",
    cancel: "Cancel",
  },
  search: {
    placeholder: "Search exercises...",
  },
  filters: {
    allEquipment: "All Equipment",
    allMuscles: "All Muscles",
  },
  sections: {
    suggested: "Suggested",
    allExercises: "All Exercises",
  },
  list: {
    empty: "No exercises match your filters.",
  },
  replaceConfirm: {
    title: "Replace exercise?",
    message:
      "This will clear the current weight, reps, time, RPE, and completed sets for this exercise.",
    override: "Override",
    addBelow: "Add Below",
  },
} as const;
