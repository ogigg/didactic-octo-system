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
  password: {
    label: "Hasło",
    setLabel: "Ustaw hasło",
    changeLabel: "Zmień hasło",
    description: "Dodaj lub zaktualizuj logowanie emailem i hasłem.",
    header: "Hasło",
    setTitle: "Ustaw hasło",
    changeTitle: "Zmień swoje hasło",
    setBody:
      "Dodaj logowanie emailem i hasłem bez odłączania dotychczasowej metody logowania.",
    changeBody: "Wybierz nowe hasło do swojego konta.",
    emailLabel: "Email do logowania",
    appleNote:
      "Logowanie przez Apple nadal będzie działać. Użyj powyższego emaila i nowego hasła.",
    newPasswordLabel: "Nowe hasło",
    confirmPasswordLabel: "Potwierdź nowe hasło",
    placeholder: "••••••••",
    setButton: "Ustaw hasło",
    changeButton: "Zmień hasło",
    successSet: "Hasło ustawione. Możesz teraz logować się także emailem.",
    successChanged: "Hasło zmienione.",
    reauthApple:
      "Ze względów bezpieczeństwa potwierdź swoją tożsamość przez Apple i spróbuj ponownie.",
    reauthAppleButton: "Potwierdź przez Apple",
    reauthCode:
      "Ze względów bezpieczeństwa wpisz kod wysłany na email do logowania i spróbuj ponownie.",
    reauthCodeLabel: "Kod bezpieczeństwa",
    reauthCodePlaceholder: "6-cyfrowy kod",
    requestNewCode: "Wyślij nowy kod",
    loading: "Wczytywanie konta",
    errors: {
      load: "Nie udało się wczytać konta. Spróbuj ponownie.",
      weak: "Wybierz silniejsze hasło i spróbuj ponownie.",
      same: "Nowe hasło musi różnić się od obecnego.",
      session: "Sesja wygasła. Zaloguj się ponownie, aby kontynuować.",
      reauth: "Nie udało się potwierdzić Twojej tożsamości. Spróbuj ponownie.",
      code: "Kod bezpieczeństwa jest nieprawidłowy lub wygasł. Poproś o nowy.",
      generic: "Nie udało się zaktualizować hasła. Spróbuj ponownie.",
      accountMismatch: "Konto Apple nie pasuje do zalogowanego konta.",
    },
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
