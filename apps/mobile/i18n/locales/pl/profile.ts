export const profile = {
  title: "Profil",
  subtitle: "Twój trening w skrócie",
  stats: {
    trainingsCompleted: "UKOŃCZONE TRENINGI",
    loadFailed: "Nie udało się wczytać. Przeciągnij w dół, aby odświeżyć.",
  },
  chart: {
    title: "Tygodniowy czas",
    subtitle: "Ostatnie 12 tygodni",
    unitMinutes: "min",
  },
  sections: {
    tracking: "Śledzenie",
    settings: "Trening",
    devices: "Urządzenia",
    account: "Konto",
  },
  nav: {
    subscription: "Subskrypcja",
    statistics: "Statystyki",
    calendar: "Kalendarz",
    measures: "Pomiary",
    history: "Historia",
    trainingPreferences: "Preferencje",
    strengthBaselines: "Siła",
    health: "Zdrowie",
    watch: "Apple Watch",
    feedback: "Opinie",
    accountData: "Konto i dane",
  },
  language: {
    label: "Język",
    english: "English",
    polish: "Polski",
    accessibility: "Zmień język aplikacji na {{language}}",
  },
  theme: {
    label: "Wygląd",
    options: {
      system: "Auto",
      light: "Jasny",
      dark: "Ciemny",
    },
    accessibility: {
      system: "Dopasuj wygląd do ustawień urządzenia",
      light: "Zawsze używaj jasnego wyglądu",
      dark: "Zawsze używaj ciemnego wyglądu",
    },
  },
} as const;
