export const exercisePicker = {
  header: {
    titleReplace: "Replace Exercise",
    titleAdd: "Add Exercise",
    cancel: "Cancel",
  },
  search: {
    placeholder: "Search exercises...",
    clear: "Clear exercise search",
  },
  filters: {
    allEquipment: "All Equipment",
    allMuscles: "All Muscles",
    equipmentSelected_one: "{{count}} Equipment",
    equipmentSelected_other: "{{count}} Equipment",
    equipmentSheetTitle: "Equipment",
    musclesSelected_one: "{{count}} Muscle",
    musclesSelected_other: "{{count}} Muscles",
    muscleSheetTitle: "Muscle Group",
  },
  sections: {
    suggested: "Suggested",
    allExercises: "All Exercises",
  },
  list: {
    empty: "No exercises match your filters.",
  },
  addError: {
    title: "Couldn't add exercise",
    message: "Please try again. Your workout hasn't been changed.",
  },
  replaceConfirm: {
    title: "Replace exercise?",
    message:
      "This will clear the current weight, reps, time, RPE, and completed sets for this exercise.",
    override: "Override",
    addBelow: "Add Below",
  },
} as const;
