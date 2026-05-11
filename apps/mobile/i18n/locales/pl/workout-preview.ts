export const workoutPreview = {
  header: {
    back: "Wroc",
  },
  meta: {
    exercises: "{{count}} cwiczen",
    duration: "~{{minutes}} min",
    focus: "Cel",
  },
  exerciseList: {
    setsReps: "{{sets}} x {{reps}}",
    setsRepsLoad: "{{sets}} x {{reps}} x {{load}}",
    warmup: "Rozgrzewka",
    working: "Robocze",
    swap: "Zamien",
    rest: "{{seconds}} s przerwy",
  },
  edit: {
    toggle: "Edytuj",
    done: "Gotowe",
    kg: "{{unit}}",
    reps: "powt.",
  },
  actions: {
    startWorkout: "Zacznij trening",
    regenerate: "Wygeneruj ponownie",
    regeneratedToday: "Wygenerowano dzis",
    regenerating: "Generowanie...",
    regenerationAvailable: "Dostepne raz dziennie dla kazdego planu.",
    regenerationUnavailableToday:
      "Ten plan zostal juz dzis wygenerowany ponownie. Sprobuj jutro.",
  },
  regenerate: {
    confirmTitle: "Wygenerowac nowy trening?",
    confirmMessage:
      "To zastapi obecny trening. Mozesz wygenerowac go ponownie tylko raz dziennie.",
    confirm: "Wygeneruj ponownie",
    cancel: "Anuluj",
  },
  empty: {
    title: "Brak danych treningu",
    subtitle: "Ten trening nadal jest generowany.",
  },
  status: {
    regeneratingTitle: "Odswiezanie planu",
    regeneratingMessage:
      "Ten trening jest teraz zastepowany. Zaktualizowana wersja pojawi sie automatycznie, gdy bedzie gotowa.",
  },
} as const;
