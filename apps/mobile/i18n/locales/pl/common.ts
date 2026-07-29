export const common = {
  nav: {
    home: "Start",
    calendar: "Kalendarz",
    profile: "Profil",
    modal: "Modal",
    designSystem: "System designu",
  },
  action: {
    goToHome: "Przejdź do ekranu startowego",
    learnMore: "Dowiedz się więcej",
    share: "Udostępnij",
    delete: "Usuń",
    action: "Akcja",
  },
  alert: {
    actionPressed: "Naciśnięto akcję",
    sharePressed: "Naciśnięto udostępnianie",
    deletePressed: "Naciśnięto usuwanie",
  },
  media: {
    exerciseIllustration: "Ilustracja ćwiczenia {{exerciseName}}",
  },
  sync: {
    syncing: "Zapisywanie zmian…",
    offline:
      "Zapisano na tym urządzeniu. Zsynchronizujemy dane po odzyskaniu połączenia.",
    failed:
      "Twoje dane są bezpieczne na tym urządzeniu, ale synchronizacja się nie udała.",
    failedAgain:
      "Nadal nie można zsynchronizować. Twoje dane pozostają bezpieczne na tym urządzeniu.",
    recovered: "Twoje dane zostały zapisane na koncie.",
    retry: "Ponów",
    retrying: "Ponawianie",
    support: "Skontaktuj się z pomocą",
    reference: "Numer zgłoszenia: {{reference}}",
  },
} as const;
