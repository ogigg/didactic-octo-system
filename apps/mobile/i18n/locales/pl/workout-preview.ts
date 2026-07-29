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
    progressionAdjustment: "Dostosowanie progresji",
    progression: {
      staleHistoryHold:
        "Cele utrzymano, ponieważ dostępna historia wyników jest nieaktualna.",
      staleHistoryDeload:
        "Cele ostrożnie obniżono, ponieważ dostępna historia wyników jest nieaktualna.",
      feedbackTooHardHold:
        "Cele utrzymano, ponieważ poprzednia sesja została oceniona jako zbyt trudna.",
      feedbackTooHardDeload:
        "Cele ostrożnie obniżono, ponieważ poprzednia sesja została oceniona jako zbyt trudna.",
      highRpeHold:
        "Cele utrzymano, ponieważ ostatnia seria robocza osiągnęła RPE 9 lub wyższe.",
      highRpeDeload:
        "Cele ostrożnie obniżono, ponieważ ostatnia seria robocza osiągnęła RPE 9 lub wyższe.",
      feedbackConflictHold:
        "Cele utrzymano, ponieważ ocena „za łatwo” była sprzeczna z ostatnim RPE 9 lub wyższym.",
      feedbackConflictDeload:
        "Cele ostrożnie obniżono, ponieważ ocena „za łatwo” była sprzeczna z ostatnim RPE 9 lub wyższym.",
      feedbackTooEasy:
        "Cele zwiększono, ponieważ poprzednia sesja została oceniona jako zbyt łatwa.",
      repRangeIncrease:
        "Liczbę powtórzeń zwiększono w skonfigurowanym zakresie treningowym.",
      weightIncrement:
        "Obciążenie zwiększono o skonfigurowany krok dla sprzętu.",
      timeIncrement: "Czas zwiększono o skonfigurowany krok.",
    },
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
    confirmWithFeedback: "Wygeneruj z uwagą",
    cancel: "Anuluj",
    dismiss: "Zamknij uwagi do regeneracji",
    sheetTitle: "Co zmienić?",
    sheetMessage:
      "Dodaj krótką uwagę do kolejnej wersji albo pomiń ją i odśwież plan bez zmian.",
    feedbackPlaceholder:
      "Np. mniej pracy dla odcinka lędźwiowego, zostaw wyciskanie, skróć trening...",
    feedbackAccessibilityLabel: "Uwagi do ponownego generowania",
    feedbackCount: "{{count}}/{{max}}",
    skipFeedback: "Pomiń uwagę",
    limitNote:
      "Ponowne generowanie zastępuje ten trening i jest dostępne raz dziennie.",
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
