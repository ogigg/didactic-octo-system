export const home = {
  welcome: "Witaj!",
  step1: {
    title: "Krok 1: Wyprobuj",
    description:
      "Edytuj <bold>app/(tabs)/index.tsx</bold>, aby zobaczyc zmiany. Nacisnij <bold>{{shortcut}}</bold>, aby otworzyc narzedzia developerskie.",
  },
  step2: {
    title: "Krok 2: Eksploruj",
    description:
      "Dotknij karty Eksploruj, aby dowiedziec sie wiecej o tym starterze.",
  },
  step3: {
    title: "Krok 3: Zacznij od nowa",
    description:
      "Gdy bedziesz gotowy, uruchom <bold>npm run reset-project</bold>, aby dostac swiezy katalog <bold>app</bold>. Obecny <bold>app</bold> zostanie przeniesiony do <bold>app-example</bold>.",
  },
  menu: {
    more: "Wiecej",
  },
  greeting: {
    morning: "Dzien dobry",
    afternoon: "Milego popoludnia",
    evening: "Dobry wieczor",
    subtitle: "Gotowy na trening?",
  },
  weeklyProgress: {
    title: "Ten tydzien",
    completed_one: "{{count}} trening ukonczony",
    completed_few: "{{count}} treningi ukonczone",
    completed_many: "{{count}} treningow ukonczonych",
    completed_other: "{{count}} treningu ukonczonego",
  },
  workoutQueue: {
    title: "Twoj plan",
    readyCount: "{{ready}}/{{total}}",
    empty: "Brak treningow w kolejce",
    emptySubtitle: "Ukoncz onboarding, aby dostac spersonalizowany plan",
    emptyReady: "Twoje treningi pojawia sie tutaj",
    emptyReadySubtitle: "Wygeneruj pierwszy trening AI, aby zaczac",
    generate: "Wygeneruj trening AI",
  },
  queueCard: {
    dayLabel: "Dzien {{position}}",
    startWorkout: "Zacznij trening",
    resumeWorkout: "Wznow trening",
    generating: "Przygotowywanie treningu...",
    regenerating: "Odswiezanie treningu",
    regeneratingSubtitle: "Trening zastepczy jest w drodze.",
    regenerationUnavailableToday:
      "Plan zostal juz dzis odswiezony. Mozesz wygenerowac go ponownie jutro.",
    queued: "Nastepny",
    failed: "Nie udalo sie wygenerowac",
    tryAgain: "Sprobuj ponownie",
    completed: "Gotowe",
    exerciseCount: "+{{count}} wiecej",
    duration: "{{minutes}} min",
    setsAndReps: "{{sets}}x{{reps}}",
  },
  myWorkouts: {
    title: "Moje treningi",
    create: "Utworz trening",
    exerciseCount_one: "{{count}} cwiczenie",
    exerciseCount_few: "{{count}} cwiczenia",
    exerciseCount_many: "{{count}} cwiczen",
    exerciseCount_other: "{{count}} cwiczenia",
    empty: "Utworz pierwszy wlasny trening",
    newWorkoutName: "Nowy trening",
  },
  history: {
    seeAll: "Zobacz historie treningow",
  },
} as const;
