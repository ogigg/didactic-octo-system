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
  saveError: {
    title: "Exercise added but not saved",
    message:
      "The exercise is in your workout, but the change couldn't be saved on this device. Try editing the workout again before closing the app.",
  },
  replaceConfirm: {
    title: "Replace exercise?",
    message:
      "This will clear the current weight, reps, time, RPE, and completed sets for this exercise.",
    override: "Override",
    addBelow: "Add Below",
  },
} as const;
