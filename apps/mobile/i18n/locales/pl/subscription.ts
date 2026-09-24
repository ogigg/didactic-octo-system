export const subscription = {
  badge: {
    pro: "pro",
  },
  usage: {
    label: "Generacje AI",
    count: "{{used}} / {{limit}}",
    weekly: "w tym tygodniu",
  },
  paywall: {
    title: "Osiągnięto tygodniowy limit",
    subtitle: "Wykorzystano {{used}} z {{limit}} generacji w tym tygodniu",
    benefitsTitle: "Przejdź na Pro",
    benefits: {
      unlimited: "Nielimitowane treningi AI",
      insights: "Zaawansowane wnioski o progresie",
      priority: "Priorytetowe generowanie",
      focus: "Własny cel treningowy",
    },
    upgradeCta: "Przejdź na Pro",
    dismiss: "Nie teraz",
    comingSoon: "Subskrypcje Pro wkrótce - stay tuned!",
  },
  screen: {
    title: "Subskrypcja",
    backAccessibilityLabel: "Wróć",
    currentPlan: {
      freeTitle: "Plan darmowy",
      freeDescription: "5 generacji AI tygodniowo",
      proTitle: "Plan Pro",
      proDescription: "Nielimitowane generacje AI",
      thisWeek: "Ten tydzień",
    },
    benefitsTitle: "Odblokuj Pro",
    benefits: {
      unlimited: {
        title: "Nielimitowane treningi AI",
        description: "Generuj tyle treningów, ile potrzebujesz",
      },
      insights: {
        title: "Zaawansowane wnioski o progresie",
        description: "Krzywe siły i trendy objętości",
      },
      priority: {
        title: "Priorytetowe generowanie",
        description: "Szybsze odpowiedzi AI",
      },
      focus: {
        title: "Własny cel treningowy",
        description: "Celuj w konkretne grupy mięśniowe",
      },
    },
    upgradeCta: "Przejdź na Pro",
    comingSoon: "Subskrypcje Pro wkrótce - stay tuned!",
    management: {
      description:
        "Opłaty za subskrypcję w sklepie trwają do czasu anulowania jej w Apple lub Google Play.",
      button: "Zarządzaj subskrypcją w sklepie",
      accessibilityLabel: "Zarządzaj subskrypcją w sklepie",
      errorTitle: "Nie udało się otworzyć zarządzania subskrypcją",
      errorMessage:
        "Otwórz ustawienia subskrypcji w App Store lub Google Play, aby zarządzać płatnościami.",
    },
  },
} as const;
