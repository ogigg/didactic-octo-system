export const healthSync = {
  prompt: {
    title: "Synchronizować z Apple Health?",
    titleAndroid: "Synchronizować z Health Connect?",
    message:
      "Sweaty może zapisywać ukończone treningi, aby pojawiały się razem z Twoją aktywnością. Zapisujemy tylko typ treningu oraz czas rozpoczęcia i zakończenia - ćwiczenia, serie i ciężary zostają w Sweaty.",
    messageAndroid:
      "Sweaty może zapisywać ukończone treningi w Health Connect. Zapisujemy tylko typ treningu oraz czas rozpoczęcia i zakończenia - ćwiczenia, serie i ciężary zostają w Sweaty.",
    allow: "Zezwól",
    notNow: "Nie teraz",
  },
  priming: {
    title: "Synchronizuj z Apple Health",
    titleAndroid: "Synchronizuj z Health Connect",
    subtitle: "Połącz dane zdrowotne, aby mieć pełny obraz treningu.",
    subtitleAndroid:
      "Połącz Health Connect, aby synchronizować dane treningowe.",
    benefits: {
      heartRate: "Śledź tętno podczas treningów",
      dashboard: "Zobacz treningi w panelu zdrowia",
      onePlace: "Trzymaj dane fitness w jednym miejscu",
    },
    privacy:
      "Czytamy tylko tętno i zapisujemy podsumowania treningów. Twoje dane pozostają prywatne.",
    connect: "Połącz",
    connecting: "Łączenie...",
    notNow: "Nie teraz",
  },
  settings: {
    title: "Integracja ze zdrowiem",
    status: {
      connected: "Połączono",
      syncOff: "Synchronizacja wyłączona",
      notConnected: "Nie połączono",
      notRequested: "Nie poproszono",
      restricted: "Ograniczono",
      unavailable: "Niedostępne",
      unknown: "Nie skonfigurowano",
    },
    description:
      "Sweaty synchronizuje ukończone treningi i odczytuje tętno z Twojej platformy zdrowia.",
    descriptionAndroid:
      "Sweaty synchronizuje ukończone treningi z Health Connect.",
    connectButton: "Połącz",
    openSettingsButton: "Otwórz ustawienia",
    recoveryButton: "Jak włączyć dostęp",
    recoveryTitle: "Włącz dostęp do Apple Health",
    recoveryInstructions:
      "Otwórz aplikację Zdrowie, stuknij swoje zdjęcie profilowe, a następnie w sekcji Prywatność stuknij Aplikacje. Wybierz Sweaty i włącz kategorie zdrowotne, które chcesz udostępnić.",
    recoveryDismiss: "Rozumiem",
    recoveryHint:
      "Uprawnieniami Apple Health zarządza się w aplikacji Zdrowie. Stuknij powyżej, aby zobaczyć dokładne kroki.",
    recoveryHintAndroid:
      "Przyznaj uprawnienia w Health Connect, aby włączyć synchronizację.",
    restrictedHint:
      "Apple Health jest ograniczone na tym iPhonie. Jeśli to urządzenie zarządzane, skontaktuj się z administratorem.",
    nativeAccessRetainedHint:
      "Synchronizacja w Sweaty jest wyłączona. Dostęp Apple Health pozostaje bez zmian i możesz połączyć się ponownie w dowolnym momencie.",
    resetButton: "Rozłącz",
    resetConfirmTitle: "Rozłączyć zdrowie?",
    resetConfirmMessage:
      "Sweaty przestanie synchronizować treningi. Wcześniej zsynchronizowane dane pozostaną w aplikacji zdrowia.",
    resetConfirmCancel: "Anuluj",
    resetConfirmOk: "Rozłącz",
    platformLabel: "Apple Health",
    platformLabelAndroid: "Health Connect",
  },
} as const;
