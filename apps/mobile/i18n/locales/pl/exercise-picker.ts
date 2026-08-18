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
    favorites: "Ulubione",
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
    favorites: "Ulubione",
    allExercises: "Wszystkie ćwiczenia",
  },
  row: {
    favorite: "Ulubione",
  },
  list: {
    empty: "Brak ćwiczeń pasujących do filtrów.",
    emptyFavorites: "Brak ulubionych ćwiczeń",
    emptyFavoritesHint:
      "Oznacz ćwiczenie jako preferowane, aby szybko je tu znaleźć.",
  },
  replaceConfirm: {
    title: "Zamienić ćwiczenie?",
    message:
      "Wyczyści to obecny ciężar, powtórzenia, czas, RPE i ukończone serie dla tego ćwiczenia.",
    override: "Nadpisz",
    addBelow: "Dodaj poniżej",
  },
} as const;
