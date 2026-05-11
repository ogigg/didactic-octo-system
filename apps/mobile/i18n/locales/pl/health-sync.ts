export const healthSync = {
  prompt: {
    title: "Synchronizowac z Apple Health?",
    titleAndroid: "Synchronizowac z Health Connect?",
    message:
      "Sweaty moze zapisywac ukonczone treningi, aby pojawialy sie razem z Twoja aktywnoscia. Zapisujemy tylko typ treningu oraz czas rozpoczecia i zakonczenia - cwiczenia, serie i ciezary zostaja w Sweaty.",
    messageAndroid:
      "Sweaty moze zapisywac ukonczone treningi w Health Connect. Zapisujemy tylko typ treningu oraz czas rozpoczecia i zakonczenia - cwiczenia, serie i ciezary zostaja w Sweaty.",
    allow: "Zezwol",
    notNow: "Nie teraz",
  },
  priming: {
    title: "Synchronizuj z Apple Health",
    titleAndroid: "Synchronizuj z Health Connect",
    subtitle: "Polacz dane zdrowotne, aby miec pelny obraz treningu.",
    subtitleAndroid:
      "Polacz Health Connect, aby synchronizowac dane treningowe.",
    benefits: {
      heartRate: "Sledz tetno podczas treningow",
      dashboard: "Zobacz treningi w panelu zdrowia",
      onePlace: "Trzymaj dane fitness w jednym miejscu",
    },
    privacy:
      "Czytamy tylko tetno i zapisujemy podsumowania treningow. Twoje dane pozostaja prywatne.",
    connect: "Polacz",
    connecting: "Laczenie...",
    notNow: "Nie teraz",
  },
  settings: {
    title: "Integracja ze zdrowiem",
    status: {
      connected: "Polaczono",
      notConnected: "Nie polaczono",
      skipped: "Odrzucono",
      unavailable: "Niedostepne",
      unknown: "Nie skonfigurowano",
    },
    description:
      "Sweaty synchronizuje ukonczone treningi i odczytuje tetno z Twojej platformy zdrowia.",
    descriptionAndroid:
      "Sweaty synchronizuje ukonczone treningi z Health Connect.",
    connectButton: "Polacz",
    openSettingsButton: "Otworz ustawienia",
    resetButton: "Rozlacz",
    resetConfirmTitle: "Rozlaczyc zdrowie?",
    resetConfirmMessage:
      "Sweaty przestanie synchronizowac treningi. Wczesniej zsynchronizowane dane pozostana w aplikacji zdrowia.",
    resetConfirmCancel: "Anuluj",
    resetConfirmOk: "Rozlacz",
    platformLabel: "Apple Health",
    platformLabelAndroid: "Health Connect",
  },
} as const;
