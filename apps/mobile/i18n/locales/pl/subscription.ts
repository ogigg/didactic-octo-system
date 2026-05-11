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
    title: "Osiagnieto tygodniowy limit",
    subtitle: "Wykorzystano {{used}} z {{limit}} generacji w tym tygodniu",
    benefitsTitle: "Przejdz na Pro",
    benefits: {
      unlimited: "Nielimitowane treningi AI",
      insights: "Zaawansowane wnioski o progresie",
      priority: "Priorytetowe generowanie",
      focus: "Wlasny cel treningowy",
    },
    upgradeCta: "Przejdz na Pro",
    dismiss: "Nie teraz",
    comingSoon: "Subskrypcje Pro wkrotce - stay tuned!",
  },
  screen: {
    title: "Subskrypcja",
    currentPlan: {
      freeTitle: "Plan darmowy",
      freeDescription: "5 generacji AI tygodniowo",
      proTitle: "Plan Pro",
      proDescription: "Nielimitowane generacje AI",
      thisWeek: "Ten tydzien",
    },
    benefitsTitle: "Odblokuj Pro",
    benefits: {
      unlimited: {
        title: "Nielimitowane treningi AI",
        description: "Generuj tyle treningow, ile potrzebujesz",
      },
      insights: {
        title: "Zaawansowane wnioski o progresie",
        description: "Krzywe sily i trendy objetosci",
      },
      priority: {
        title: "Priorytetowe generowanie",
        description: "Szybsze odpowiedzi AI",
      },
      focus: {
        title: "Wlasny cel treningowy",
        description: "Celuj w konkretne grupy miesniowe",
      },
    },
    upgradeCta: "Przejdz na Pro",
    comingSoon: "Subskrypcje Pro wkrotce - stay tuned!",
  },
} as const;
