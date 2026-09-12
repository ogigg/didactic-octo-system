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
  export: {
    label: "Eksportuj historię treningów",
    description: "Pobierz dane treningowe lub raport PDF dla trenera.",
    title: "Eksport historii treningów",
    intro:
      "Wybierz zakres dat i format pliku. Menu udostępniania pozwoli Ci zapisać lub wysłać eksport.",
    periodLabel: "Zakres dat",
    periods: {
      seven: "7 dni",
      thirty: "30 dni",
      ninety: "90 dni",
      all: "Wszystko",
    },
    formatLabel: "Format pliku",
    formats: {
      csv: "CSV",
      json: "JSON",
      pdf: "PDF",
    },
    formatHelp: {
      csv: "Jeden wiersz na serię, gotowy do użycia w arkuszu.",
      json: "Przejrzysty zapis treningów, ćwiczeń, wyników, komentarzy i ocen w strukturze JSON.",
      pdf: "Czytelny raport dla trenera z wykresami postępów, podsumowaniami i rekordami życiowymi.",
    },
    report: {
      title: "Raport postępów treningowych",
      subtitle:
        "Zwięzły przegląd regularności, obciążenia i wyników do udostępnienia trenerowi.",
      generated: "Wygenerowano",
      period: "Okres (dni)",
      workouts: "Treningi",
      completedSets: "Ukończone serie",
      totalVolume: "Łączna objętość",
      trainingTime: "Czas treningów",
      averageRpe: "Średnie RPE",
      completionRate: "Ukończone serie",
      progressTitle: "Podsumowanie postępów",
      progressInsufficient:
        "Ukończ co najmniej cztery treningi z zapisanym ciężarem i liczbą powtórzeń, aby zobaczyć trend objętości.",
      volumeIncreased:
        "Średnia objętość treningu wzrosła o {{percent}}% w nowszej połowie tego okresu.",
      volumeDecreased:
        "Średnia objętość treningu spadła o {{percent}}% w nowszej połowie tego okresu.",
      volumeSteady:
        "Średnia objętość treningu pozostała stabilna w tym okresie.",
      weeklyTitle: "Regularność · ostatnie 8 tygodni",
      weeklyEmpty: "Brak ukończonych treningów w ostatnich ośmiu tygodniach.",
      volumeTitle: "Objętość · ostatnie 8 treningów",
      personalRecordsTitle: "Rekordy życiowe",
      personalRecordsSubtitle:
        "Rekordy siłowe są obliczane na podstawie całej historii ukończonych treningów, niezależnie od wybranego okresu raportu.",
      personalRecordsEmpty: "Brak rekordów dla ćwiczeń z obciążeniem.",
      exercise: "Ćwiczenie",
      bestWeight: "Największy ciężar",
      bestSetVolume: "Objętość serii",
      estimatedOneRepMax: "Szac. 1RM",
      recentWorkoutsTitle: "Ostatnie treningi",
      date: "Data",
      workout: "Trening",
      sets: "Serie",
      volume: "Objętość",
      duration: "Czas",
      minutes: "min",
      sessions: "treningów",
      footer:
        "Wygenerowano w Sweaty na podstawie ukończonych treningów. Decyzje treningowe konsultuj z wykwalifikowanym trenerem.",
    },
    privacyTitle: "Twoje dane pozostają pod Twoją kontrolą",
    privacyBody:
      "Plik jest tworzony na tym urządzeniu i trafia wyłącznie do wybranego przez Ciebie miejsca.",
    button: "Eksportuj {{format}}",
    dialogTitle: "Eksport historii treningów",
    emptyTitle: "Brak treningów do eksportu",
    emptyBody: "W tym zakresie dat nie ma ukończonych treningów.",
    unavailableTitle: "Eksport jest niedostępny",
    unavailableBody:
      "Udostępnianie plików nie jest dostępne na tym urządzeniu.",
    errorTitle: "Nie udało się wyeksportować historii",
    errorBody: "Sprawdź połączenie i spróbuj ponownie.",
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
