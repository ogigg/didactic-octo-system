export const exercisePicker = {
  header: {
    titleReplace: "Zamień ćwiczenie",
    titleAdd: "Dodaj ćwiczenie",
    cancel: "Anuluj",
  },
  search: {
    placeholder: "Szukaj ćwiczeń...",
  },
  filters: {
    allEquipment: "Cały sprzęt",
    allMuscles: "Wszystkie mięśnie",
  },
  sections: {
    suggested: "Sugerowane",
    allExercises: "Wszystkie ćwiczenia",
  },
  list: {
    empty: "Brak ćwiczeń pasujących do filtrów.",
  },
  replaceConfirm: {
    title: "Zamienić ćwiczenie?",
    message:
      "Wyczyści to obecny ciężar, powtórzenia, czas, RPE i ukończone serie dla tego ćwiczenia.",
    override: "Nadpisz",
    addBelow: "Dodaj poniżej",
  },
} as const;
