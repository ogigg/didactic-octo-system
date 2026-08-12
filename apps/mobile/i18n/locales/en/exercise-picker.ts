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
    favorites: "Favorites",
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
    favorites: "Favorites",
    allExercises: "All Exercises",
  },
  row: {
    favorite: "Favorite",
  },
  list: {
    empty: "No exercises match your filters.",
    emptyFavorites: "No favorite exercises yet",
    emptyFavoritesHint:
      "Mark an exercise as preferred to find it here quickly.",
  },
  replaceConfirm: {
    title: "Replace exercise?",
    message:
      "This will clear the current weight, reps, time, RPE, and completed sets for this exercise.",
    override: "Override",
    addBelow: "Add Below",
  },
} as const;
