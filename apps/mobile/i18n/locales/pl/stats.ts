export const stats = {
  title: "Statystyki",
  sections: {
    activity: "Aktywnosc treningowa",
    muscles: "Rozklad miesni",
    volume: "Objetosc w czasie",
    records: "Rekordy osobiste",
  },
  heatmap: {
    workoutsThisYear: "{{count}} treningow w tym roku",
    streak: "{{count}} tygodni z rzedu",
    less: "Mniej",
    more: "Wiecej",
  },
  volume: {
    total: "Razem",
    weeklyAvg: "Sr. tygodniowa",
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
    heaviest: "Najciezsze",
    mostReps: "Najwiecej powt.",
    bestSet: "Najlepsza seria",
    est1rm: "Szac. 1RM",
    searchPlaceholder: "Szukaj cwiczen...",
    empty: "Ukoncz treningi, aby zobaczyc rekordy",
    noResults: "Brak cwiczen pasujacych do wyszukiwania",
  },
  empty: {
    title: "Brak danych",
    subtitle: "Ukoncz pierwszy trening, aby zobaczyc statystyki",
  },
} as const;
