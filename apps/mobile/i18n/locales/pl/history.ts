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
  },
} as const;
