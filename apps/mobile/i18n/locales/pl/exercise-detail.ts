export const exerciseDetail = {
  tabs: {
    overview: "Przegląd",
    history: "Historia",
    howTo: "Jak wykonać",
  },
  overview: {
    records: "Rekordy osobiste",
    recordsHint: "Najlepsze wyniki, czytelnie zapisane.",
    sessionsCount: "{{count}} sesji",
    maxWeight: "Maks. ciężar",
    maxReps: "Maks. powtórzenia",
    bestSet: "Najlepsza seria",
    bestDuration: "Najlepszy czas",
    est1rm: "Szac. 1RM",
    maxRpe: "Maks. RPE",
    volume: "Objętość w czasie",
    achievedOn: "Osiągnięto {{date}}",
    noDate: "Data niedostępna",
    noData: "Ukończ treningi z tym ćwiczeniem, aby zobaczyć statystyki.",
  },
  history: {
    noSessions: "Nie zapisano jeszcze żadnych sesji.",
    set: "Seria {{number}}",
    completedSets: "{{count}} ukończonych serii",
  },
  howTo: {
    instructions: "Instrukcje",
    noInstructions:
      "Instrukcje dla tego ćwiczenia nie są jeszcze dostępne. Wróć wkrótce!",
    todo: "Szczegółowe poradniki techniki wkrótce.",
  },
  muscles: {
    primary: "Główne",
    secondary: "Dodatkowe",
  },
} as const;
