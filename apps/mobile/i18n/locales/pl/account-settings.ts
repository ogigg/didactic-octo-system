export const accountSettings = {
  header: {
    title: "Konto i dane",
  },
  accessibility: {
    back: "Wróć",
  },
  intro: {
    title: "Zarządzaj kontem",
    body: "Sprawdź opcje subskrypcji i danych konta w jednym miejscu.",
  },
  sections: {
    management: "Zarządzanie kontem",
    deletion: "Usuwanie danych",
  },
  subscription: {
    label: "Subskrypcja",
    description: "Status subskrypcji i płatności są zarządzane osobno.",
    errorTitle: "Nie udało się otworzyć zarządzania subskrypcją",
    errorMessage:
      "Otwórz ustawienia subskrypcji w App Store lub Google Play, aby zarządzać płatnościami.",
  },
  difference: {
    title: "Te działania różnią się od siebie",
    body: "Wylogowanie kończy tylko bieżącą sesję. Anulowanie subskrypcji zatrzymuje przyszłe opłaty, ale zachowuje konto. Usunięcie konta usuwa profil i dane treningowe, ale nie anuluje subskrypcji rozliczanych przez App Store lub Google Play.",
  },
  deletion: {
    label: "Usuń konto",
    description:
      "Sprawdź skutki trwałego usunięcia danych i 14-dniowy okres ochronny.",
    accessibilityLabel: "Usuń konto, działanie destrukcyjne",
    subscriptionWarning: {
      title: "Najpierw anulować opłaty w sklepie?",
      message:
        "Usunięcie konta nie anuluje subskrypcji w App Store ani Google Play. Najpierw zarządzaj płatnościami albo świadomie kontynuuj, jeśli subskrypcja została już anulowana lub akceptujesz dalsze opłaty.",
      cancel: "Nie teraz",
      manage: "Zarządzaj subskrypcją",
      continue: "Przejdź do usuwania",
    },
  },
} as const;
