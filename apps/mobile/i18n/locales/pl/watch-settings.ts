export const watchSettings = {
  title: "Apple Watch",
  intro:
    "Rozpocznij trening na iPhonie, a następnie zapisuj serie, zarządzaj przerwami i sprawdzaj tętno na nadgarstku.",
  status: {
    checking: "Sprawdzanie połączenia z Apple Watch…",
    nonIos: "Apple Watch jest dostępny w aplikacji na iPhone’a.",
    notPaired:
      "Brak sparowanego Apple Watch. Twoje preferencje zostaną zachowane na później.",
    notInstalled:
      "Aplikacja na zegarku nie jest zainstalowana. Zainstaluj Sweaty w aplikacji Watch na iPhonie.",
    unreachable:
      "Aplikacja jest zainstalowana. Zmiany zsynchronizują się, gdy Apple Watch ponownie się połączy.",
    ready: "Połączono i gotowe.",
  },
  helper: {
    queued:
      "Zmiany są zapisywane na tym iPhonie i zostaną zastosowane, gdy Apple Watch będzie dostępny.",
    unavailable:
      "Preferencje Apple Watch możesz edytować w aplikacji na iPhonie.",
  },
  sections: {
    restTimer: "Minutnik przerwy",
    workoutInteraction: "Obsługa treningu",
    display: "Wyświetlanie",
  },
  restTimer: {
    warning: {
      label: "Ostrzeżenie przed końcem przerwy",
      description: "Poczuj stuknięcie, zanim minutnik przerwy dojdzie do zera.",
      off: "Wyłączone",
      five: "5 s",
      ten: "10 s",
      fifteen: "15 s",
      thirty: "30 s",
      accessibility: "{{label}}, wybrano {{value}}",
    },
    endHaptics: {
      label: "Wibracja po zakończeniu przerwy",
      description:
        "Poczuj potwierdzające stuknięcie, gdy przerwa dojdzie do zera.",
      accessibilityHint:
        "Steruje potwierdzającym stuknięciem na końcu przerwy.",
    },
    adjustment: {
      label: "Szybka zmiana czasu",
      description: "Wybierz, o ile przyciski − i + zmieniają czas przerwy.",
      ten: "10 s",
      fifteen: "15 s",
      thirty: "30 s",
      accessibility: "{{label}}, wybrano {{value}}",
    },
    autoShow: {
      label: "Otwieraj minutnik po serii",
      description: "Automatycznie pokaż odliczanie po zapisaniu serii.",
      accessibilityHint: "Otwiera odliczanie przerwy po zapisaniu serii.",
    },
    completion: {
      label: "Po zakończeniu przerwy",
      description: "Wybierz działanie po dojściu odliczania do zera.",
      stayOnTimer: "Pozostań na minutniku",
      openNextSet: "Otwórz następną serię",
      accessibility: "{{label}}, wybrano {{value}}",
    },
  },
  workoutInteraction: {
    setHaptics: {
      label: "Wibracja po zapisaniu serii",
      description: "Poczuj lekkie stuknięcie po zapisaniu każdej serii.",
      accessibilityHint: "Steruje lekkim stuknięciem po zapisaniu serii.",
    },
    skipConfirmation: {
      label: "Potwierdzaj pominięcie przerwy",
      description:
        "Wymagaj drugiego stuknięcia przed wcześniejszym zakończeniem przerwy.",
      accessibilityHint:
        "Wymaga drugiego stuknięcia przed pominięciem przerwy.",
    },
    endConfirmation: {
      label: "Potwierdzaj zakończenie treningu",
      description: "Wymagaj drugiego stuknięcia przed zakończeniem treningu.",
      accessibilityHint:
        "Wymaga drugiego stuknięcia przed zakończeniem treningu.",
    },
  },
  display: {
    heartRate: {
      label: "Pokazuj tętno na żywo",
      description: "Pokazuj funkcje tętna podczas treningu na zegarku.",
      accessibilityHint: "Steruje funkcjami tętna podczas treningu na zegarku.",
    },
    previousPerformance: {
      label: "Pokazuj poprzedni wynik",
      description: "Pokazuj ostatni wynik obok celu bieżącej serii.",
      accessibilityHint: "Steruje kartą poprzedniego wyniku.",
    },
  },
} as const;
