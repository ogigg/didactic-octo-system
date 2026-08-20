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
    recovery: {
      accessibilityLabel: "Trening na dzień {{position}} wymaga naprawy",
      retryTitle: "Spróbuj ponownie przygotować trening",
      retryDescription:
        "Twoje ustawienia są zapisane. Ponów próbę bez rozpoczynania onboardingu od nowa. Próba {{next}} z {{max}}.",
      fallbackTitle: "Nie udało się naprawić tego treningu",
      fallbackDescription:
        "Użyj teraz sprawdzonego planu awaryjnego albo skontaktuj się ze wsparciem, podając poniższy kod.",
      useFallback: "Użyj treningu awaryjnego",
      contactSupport: "Skontaktuj się ze wsparciem",
      reference: "Kod dla wsparcia: {{reference}}",
      fallbackErrorTitle: "Plan awaryjny jest niedostępny",
      fallbackErrorDescription:
        "Nie udało się zastosować treningu awaryjnego. Spróbuj ponownie albo skontaktuj się ze wsparciem, podając widoczny kod.",
      fallbackWorkout: {
        focusAreas: {
          push: "wypychanie",
          pull: "przyciąganie",
          legs: "nogi",
          upper: "górna część ciała",
          lower: "dolna część ciała",
          full_body: "całe ciało",
        },
        name: "Plan awaryjny: {{focusArea}}",
        muscleGroups:
          "Ten plan awaryjny koncentruje się na {{focusArea}}, aby zachować ciągłość tygodnia.",
        trainingStrategy:
          "Wykorzystuje znane ćwiczenia i zachowawcze cele po kilku nieudanych próbach generowania.",
        notes:
          "Szablon awaryjny użyty po kilku nieudanych próbach generowania.",
        exerciseMuscles:
          "{{exerciseName}} angażuje {{muscles}} w treningu {{focusArea}}.",
        exerciseSelection:
          "Ćwiczenie wybrano z dostępnego katalogu jako niezawodną opcję awaryjną.",
      },
    },
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
  },
  history: {
    seeAll: "Zobacz historię treningów",
  },
} as const;
