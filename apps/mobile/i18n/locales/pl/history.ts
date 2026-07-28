export const history = {
  header: {
    back: "Wróć",
  },
  title: "Historia",
  dayTitle: "Treningi: {{date}}",
  empty: {
    title: "Brak treningów",
    subtitle: "Ukończ pierwszy trening, aby zobaczyć go tutaj.",
    dayTitle: "Brak treningów tego dnia",
    daySubtitle: "Wybierz inny dzień w kalendarzu.",
  },
  card: {
    duration: "Czas",
    volume: "Objętość",
    sets: "Serie",
    moreExercises: "+{{count}} więcej",
  },
  detail: {
    fallbackName: "Trening",
    muscleDistribution: "Rozkład mięśni",
    noMuscleData: "Brak danych o mięśniach",
    heartRate: {
      title: "Tętno",
      unit: "bpm",
      avg: "Śr.",
      min: "Min.",
      max: "Maks.",
    },
    summary: {
      duration: "Czas",
      volume: "Objętość",
      sets: "Serie",
    },
    setFormat: "{{weight}} x {{reps}}",
    setFormatNoLog: "-",
    incomplete: "Nieukończone",
    comments: {
      title: "Twoje notatki",
    },
    deleteExercise: {
      accessibilityLabel: "Usuń {{exerciseName}} z tego treningu",
      confirmTitle: "Usunąć ćwiczenie?",
      confirmMessage:
        "Spowoduje to trwałe usunięcie ćwiczenia {{exerciseName}} oraz zapisanych serii z historii. Nie będą one już wpływać na statystyki ani przyszłe treningi.",
      cancel: "Anuluj",
      remove: "Usuń",
      errorTitle: "Nie udało się usunąć ćwiczenia",
      errorMessage: "Spróbuj ponownie za chwilę.",
    },
    deleteWorkout: {
      accessibilityLabel: "Usuń ten trening",
      button: "Usuń trening na stałe",
      deleting: "Usuwanie treningu…",
      confirmTitle: "Usunąć trening?",
      confirmMessage:
        "Trening „{{workoutName}}” z dnia {{workoutDate}} i wszystkie zapisane dane zostaną trwale usunięte. Trening zniknie z historii i nie będzie wpływać na statystyki ani przyszłe treningi.",
      unknownDate: "nieznanego dnia",
      cancel: "Anuluj",
      remove: "Usuń na stałe",
      success: "Trening został usunięty z historii.",
      errorTitle: "Nie udało się usunąć treningu",
      errorMessage: "Spróbuj ponownie za chwilę.",
    },
  },
} as const;
