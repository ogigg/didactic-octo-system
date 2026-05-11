export const history = {
  header: {
    back: "Wroc",
  },
  title: "Historia",
  dayTitle: "Treningi: {{date}}",
  empty: {
    title: "Brak treningow",
    subtitle: "Ukoncz pierwszy trening, aby zobaczyc go tutaj.",
    dayTitle: "Brak treningow tego dnia",
    daySubtitle: "Wybierz inny dzien w kalendarzu.",
  },
  card: {
    duration: "Czas",
    volume: "Objetosc",
    sets: "Serie",
    moreExercises: "+{{count}} wiecej",
  },
  detail: {
    muscleDistribution: "Rozklad miesni",
    noMuscleData: "Brak danych o miesniach",
    heartRate: {
      title: "Tetno",
      unit: "bpm",
      avg: "Sr.",
      min: "Min.",
      max: "Maks.",
    },
    summary: {
      duration: "Czas",
      volume: "Objetosc",
      sets: "Serie",
    },
    setFormat: "{{weight}} x {{reps}}",
    setFormatNoLog: "-",
    incomplete: "Nieukonczone",
    comments: {
      title: "Twoje notatki",
    },
  },
} as const;
