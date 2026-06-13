export const workoutPreview = {
  header: {
    back: "Wróć",
  },
  meta: {
    exercises: "{{count}} ćwiczeń",
    duration: "~{{minutes}} min",
    focus: "Cel",
  },
  warmup: {
    title: "Rozgrzewka",
    timer: "Timer {{time}}",
  },
  exerciseList: {
    setsReps: "{{sets}} x {{reps}}",
    setsRepsLoad: "{{sets}} x {{reps}} x {{load}}",
    warmup: "Rozgrzewka",
    working: "Robocze",
    swap: "Zamień",
    rest: "{{seconds}} s przerwy",
  },
  reasoning: {
    planTitle: "Dlaczego ten plan",
    exerciseTitle: "Dlaczego to ćwiczenie",
    show: "Pokaż",
    hide: "Ukryj",
    muscleGroups: "Grupy mięśniowe",
    trainingStrategy: "Strategia treningu",
    exerciseSelection: "Wybór ćwiczenia",
    planAccessibility: "Pokaż uzasadnienie treningu",
    exerciseAccessibility: "Pokaż uzasadnienie dla {{exerciseName}}",
  },
  edit: {
    toggle: "Edytuj",
    done: "Gotowe",
    kg: "{{unit}}",
    reps: "powt.",
  },
  setHeader: {
    set: "SERIA",
    type: "TYP",
    reps: "POWT.",
  },
  actions: {
    startWorkout: "Zacznij trening",
    regenerate: "Wygeneruj ponownie",
    regeneratedToday: "Wygenerowano dziś",
    regenerating: "Generowanie...",
    regenerationAvailable: "Dostępne raz dziennie dla każdego planu.",
    regenerationUnavailableToday:
      "Ten plan został już dziś wygenerowany ponownie. Spróbuj jutro.",
  },
  regenerate: {
    confirmTitle: "Wygenerować nowy trening?",
    confirmMessage:
      "To zastąpi obecny trening. Możesz wygenerować go ponownie tylko raz dziennie.",
    confirm: "Wygeneruj ponownie",
    cancel: "Anuluj",
  },
  empty: {
    title: "Brak danych treningu",
    subtitle: "Ten trening nadal jest generowany.",
  },
  status: {
    regeneratingTitle: "Odświeżanie planu",
    regeneratingMessage:
      "Ten trening jest teraz zastępowany. Zaktualizowana wersja pojawi się automatycznie, gdy będzie gotowa.",
  },
} as const;
