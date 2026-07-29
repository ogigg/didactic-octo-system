export const exercisePicker = {
  header: {
    titleReplace: "Zamień ćwiczenie",
    titleAdd: "Dodaj ćwiczenie",
    cancel: "Anuluj",
  },
  search: {
    placeholder: "Szukaj ćwiczeń...",
    clear: "Wyczyść wyszukiwanie ćwiczeń",
  },
  filters: {
    allEquipment: "Cały sprzęt",
    allMuscles: "Wszystkie mięśnie",
    equipmentSelected_one: "{{count}} sprzęt",
    equipmentSelected_few: "{{count}} sprzęty",
    equipmentSelected_many: "{{count}} sprzętów",
    equipmentSelected_other: "{{count}} sprzętu",
    equipmentSheetTitle: "Sprzęt",
    musclesSelected_one: "{{count}} mięsień",
    musclesSelected_few: "{{count}} mięśnie",
    musclesSelected_many: "{{count}} mięśni",
    musclesSelected_other: "{{count}} mięśnia",
    muscleSheetTitle: "Grupa mięśniowa",
  },
  sections: {
    suggested: "Sugerowane",
    allExercises: "Wszystkie ćwiczenia",
  },
  list: {
    empty: "Brak ćwiczeń pasujących do filtrów.",
  },
  addError: {
    title: "Nie udało się dodać ćwiczenia",
    message: "Spróbuj ponownie. Twój trening nie został zmieniony.",
  },
  replaceConfirm: {
    title: "Zamienić ćwiczenie?",
    message:
      "Wyczyści to obecny ciężar, powtórzenia, czas, RPE i ukończone serie dla tego ćwiczenia.",
    override: "Nadpisz",
    addBelow: "Dodaj poniżej",
  },
} as const;
