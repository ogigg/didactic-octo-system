export const streakProtection = {
  eyebrow: "Seria regularności",
  states: {
    none: {
      title: "Twoja seria jest na dobrej drodze",
      body: "Trenuj dalej we własnym tempie.",
    },
    at_risk: {
      title: "Twoja seria jest wstrzymana",
      body: "Życie się zdarza. Krótki, spokojny trening może pomóc wrócić do rytmu bez presji.",
    },
    free_earned_freeze: {
      title: "Chroń swoją serię regularności",
      body: "Masz zamrożenie serii zdobyte dzięki regularnym treningom. Użyj go za opuszczony tydzień i wróć spokojnie.",
    },
    free_lifetime_rescue: {
      title: "Twoja seria jest wstrzymana",
      body: "Możesz użyć jednorazowego przywrócenia, aby zachować serię. Bez presji — rozpoczęcie od nowa też jest w porządku.",
    },
    free_comeback: {
      title: "Wróćmy spokojnie do ruchu",
      body: "Opuszczony tydzień nie kasuje Twoich postępów. Zacznij krótkie wyzwanie powrotne albo nową serię dzisiaj.",
    },
    pro_auto_applied: {
      title: "Twoja seria jest chroniona",
      body: "Użyliśmy 1 zamrożenia Pro za opuszczony tydzień. Pozostało: {{freezes}}.",
    },
    pro_available_freeze: {
      title: "Użyć zamrożenia serii?",
      body: "Masz zamrożenie Pro dostępne za opuszczony tydzień. Użyj go, gdy będziesz gotowy wrócić.",
    },
    pro_comeback: {
      title: "Gotowy na spokojny powrót?",
      body: "Twoja seria może zacząć się dziś od treningu dopasowanego do przerwy.",
    },
  },
  metrics: {
    streakWeeks: "tyg. serii",
    freezes: "zamrożenia",
  },
  actions: {
    restoreOnce: "Przywróć raz",
    useFreeze: "Użyj zamrożenia",
    upgrade: "Przejdź na Pro",
    restart: "Zacznij serię od nowa",
    startComebackWorkout: "Zacznij trening powrotny",
    startComebackChallenge: "Zacznij wyzwanie powrotne",
    adjustPlan: "Dostosuj plan",
    notNow: "Nie teraz",
  },
  errors: {
    title: "Nie udało się zaktualizować serii",
    message: "Spróbuj ponownie za chwilę.",
  },
} as const;
