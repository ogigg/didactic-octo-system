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
      notConnected: "Nie połączono",
      skipped: "Odrzucono",
      unavailable: "Niedostępne",
      unknown: "Nie skonfigurowano",
    },
    description:
      "Sweaty synchronizuje ukończone treningi i odczytuje tętno z Twojej platformy zdrowia.",
    descriptionAndroid:
      "Sweaty synchronizuje ukończone treningi z Health Connect.",
    connectButton: "Połącz",
    openSettingsButton: "Otwórz ustawienia",
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
