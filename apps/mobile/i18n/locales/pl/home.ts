export const home = {
  welcome: "Witaj!",
  step1: {
    title: "Krok 1: Wypróbuj",
    description:
      "Edytuj <bold>app/(tabs)/index.tsx</bold>, aby zobaczyć zmiany. Naciśnij <bold>{{shortcut}}</bold>, aby otworzyć narzędzia developerskie.",
  },
  step2: {
    title: "Krok 2: Eksploruj",
    description:
      "Dotknij karty Eksploruj, aby dowiedzieć się więcej o tym starterze.",
  },
  step3: {
    title: "Krok 3: Zacznij od nowa",
    description:
      "Gdy będziesz gotowy, uruchom <bold>npm run reset-project</bold>, aby dostać świeży katalog <bold>app</bold>. Obecny <bold>app</bold> zostanie przeniesiony do <bold>app-example</bold>.",
  },
  menu: {
    more: "Więcej",
  },
  greeting: {
    morning: "Dzień dobry",
    afternoon: "Miłego popołudnia",
    evening: "Dobry wieczór",
    subtitle: "Gotowy na trening?",
  },
  weeklyProgress: {
    title: "Ten tydzień",
    completed_one: "{{count}} trening ukończony",
    completed_few: "{{count}} treningi ukończone",
    completed_many: "{{count}} treningów ukończonych",
    completed_other: "{{count}} treningu ukończonego",
  },
  workoutQueue: {
    title: "Twój plan",
    readyCount: "{{ready}}/{{total}}",
    empty: "Brak treningów w kolejce",
    emptySubtitle: "Ukończ onboarding, aby dostać spersonalizowany plan",
    emptyReady: "Twoje treningi pojawią się tutaj",
    emptyReadySubtitle: "Wygeneruj pierwszy trening AI, aby zacząć",
    generate: "Wygeneruj trening AI",
  },
  queueCard: {
    dayLabel: "Dzień {{position}}",
    startWorkout: "Zacznij trening",
    resumeWorkout: "Wznow trening",
    generating: "Przygotowywanie treningu...",
    regenerating: "Odświeżanie treningu",
    regeneratingSubtitle: "Trening zastępczy jest w drodze.",
    regenerationUnavailableToday:
      "Plan został już dziś odświeżony. Możesz wygenerować go ponownie jutro.",
    queued: "Następny",
    failed: "Nie udało się wygenerować",
    tryAgain: "Spróbuj ponownie",
    completed: "Gotowe",
    exerciseCount: "+{{count}} więcej",
    duration: "{{minutes}} min",
    setsAndReps: "{{sets}}x{{reps}}",
  },
  myWorkouts: {
    title: "Moje treningi",
    create: "Utwórz trening",
    exerciseCount_one: "{{count}} ćwiczenie",
    exerciseCount_few: "{{count}} ćwiczenia",
    exerciseCount_many: "{{count}} ćwiczeń",
    exerciseCount_other: "{{count}} ćwiczenia",
    empty: "Utwórz pierwszy własny trening",
    newWorkoutName: "Nowy trening",
    reviewTemplate: "Przejrzyj {{name}}",
  },
  templateDetail: {
    modeLabel: "Przegląd szablonu",
    description:
      "Przejrzyj poniższe ćwiczenia. Trening rozpocznie się dopiero po wybraniu opcji Zacznij trening.",
    exercisesTitle: "Ćwiczenia",
    startWorkout: "Zacznij trening",
    activeWorkoutTitle: "Trening jest już w toku",
    activeWorkoutMessage:
      "Ukończ lub odrzuć aktywny trening przed rozpoczęciem tego szablonu.",
    notFoundTitle: "Nie znaleziono szablonu",
    notFoundMessage:
      "Ten zapisany trening nie jest już dostępny. Wróć do sekcji Moje treningi i wybierz inny szablon.",
    back: "Wróć",
  },
  history: {
    seeAll: "Zobacz historię treningów",
  },
} as const;
