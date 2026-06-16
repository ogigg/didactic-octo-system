export const stats = {
  title: "Statystyki",
  sections: {
    activity: "Aktywność treningowa",
    muscles: "Rozkład mięśni",
    volume: "Objętość w czasie",
    records: "Rekordy osobiste",
  },
  heatmap: {
    workoutsThisYear: "{{count}} treningów w tym roku",
    streak: "{{count}} tygodni z rzędu",
    less: "Mniej",
    more: "Więcej",
  },
  volume: {
    total: "Razem",
    weeklyAvg: "Śr. tygodniowa",
    perWeek: "/tydz.",
    unitTonnes: "t",
    unitKg: "kg",
  },
  periods: {
    "30d": "30d",
    "90d": "90d",
    "1y": "1R",
    all: "Wszystko",
  },
  records: {
    heaviest: "Najcięższe",
    mostReps: "Najwięcej powt.",
    bestSet: "Najlepsza seria",
    est1rm: "Szac. 1RM",
    searchPlaceholder: "Szukaj ćwiczeń...",
    empty: "Ukończ treningi, aby zobaczyć rekordy",
    noResults: "Brak ćwiczeń pasujących do wyszukiwania",
  },
  empty: {
    title: "Brak danych",
    subtitle: "Ukończ pierwszy trening, aby zobaczyć statystyki",
  },
} as const;
