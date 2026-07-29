export const accountSettings = {
  header: {
    title: "Konto i dane",
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
  },
} as const;
