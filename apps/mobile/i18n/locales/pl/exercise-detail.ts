export const exerciseDetail = {
  tabs: {
    overview: "Przeglad",
    history: "Historia",
    howTo: "Jak wykonac",
  },
  overview: {
    records: "Rekordy osobiste",
    recordsHint: "Najlepsze wyniki, czytelnie zapisane.",
    sessionsCount: "{{count}} sesji",
    maxWeight: "Maks. ciezar",
    maxReps: "Maks. powtorzenia",
    bestSet: "Najlepsza seria",
    bestDuration: "Najlepszy czas",
    est1rm: "Szac. 1RM",
    maxRpe: "Maks. RPE",
    volume: "Objetosc w czasie",
    achievedOn: "Osiagnieto {{date}}",
    noDate: "Data niedostepna",
    noData: "Ukoncz treningi z tym cwiczeniem, aby zobaczyc statystyki.",
  },
  history: {
    noSessions: "Nie zapisano jeszcze zadnych sesji.",
    set: "Seria {{number}}",
    completedSets: "{{count}} ukonczonych serii",
  },
  howTo: {
    instructions: "Instrukcje",
    noInstructions:
      "Instrukcje dla tego cwiczenia nie sa jeszcze dostepne. Wroc wkrotce!",
    todo: "Szczegolowe poradniki techniki wkrotce.",
  },
  muscles: {
    primary: "Glowne",
    secondary: "Dodatkowe",
  },
} as const;
