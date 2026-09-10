export const streakProtection = {
  eyebrow: "Seria regularności",
  closeSheet: "Zamknij opcje serii",
  states: {
    none: {
      title: "Twoja seria jest na dobrej drodze",
      body: "Trenuj dalej we własnym tempie.",
    },
    at_risk: {
      title: "Twoja seria {{count}} tyg. wciąż trwa",
      body: "Trening w dowolnym dniu tego tygodnia ją podtrzyma. Krótkie sesje też się liczą.",
    },
    free_earned_freeze: {
      title: "Pokryć zeszły tydzień zamrożeniem?",
      body: "Zdobyłeś to zamrożenie dzięki regularnym treningom. Użycie go oznacza zeszły tydzień jako pokryty, więc seria trwa dalej. Pominięcie też jest w porządku — każdy trening w tym tygodniu zaczyna nowe liczenie.",
    },
    free_lifetime_rescue: {
      title: "Podtrzymać serię?",
      body: "W zeszłym tygodniu nie było treningu. Jednorazowe przywrócenie pokrywa go, więc seria trwa dalej. Możesz też po prostu zacząć trenować w tym tygodniu i liczyć od nowa — obie opcje są dobre.",
    },
    free_comeback: {
      title: "Witaj z powrotem",
      body: "W zeszłym tygodniu nie było treningu, więc liczenie serii zaczyna się od nowa. Twoja historia i postępy pozostają bez zmian. Krótki trening powrotny to najprostszy sposób, by ruszyć.",
    },
    pro_auto_applied: {
      title: "Zeszły tydzień jest pokryty",
      body_one:
        "Zamrożenie Pro zostało użyte automatycznie, więc seria trwa dalej. Pozostało {{count}} zamrożenie.",
      body_few:
        "Zamrożenie Pro zostało użyte automatycznie, więc seria trwa dalej. Pozostały {{count}} zamrożenia.",
      body_many:
        "Zamrożenie Pro zostało użyte automatycznie, więc seria trwa dalej. Pozostało {{count}} zamrożeń.",
      body_other:
        "Zamrożenie Pro zostało użyte automatycznie, więc seria trwa dalej. Pozostało {{count}} zamrożenia.",
    },
    pro_available_freeze: {
      title: "Pokryć zeszły tydzień zamrożeniem?",
      body: "W zeszłym tygodniu nie było treningu. Zamrożenie Pro pokrywa go, więc seria trwa dalej. Pominięcie też jest w porządku — każdy trening w tym tygodniu zaczyna nowe liczenie.",
    },
    pro_comeback: {
      title: "Witaj z powrotem",
      body: "W zeszłym tygodniu nie było treningu i nie zostało żadne zamrożenie, więc liczenie serii zaczyna się od nowa. Twoja historia pozostaje bez zmian. Zacznij treningiem dopasowanym do przerwy albo dostosuj plan, jeśli tydzień był zbyt napięty.",
    },
  },
  details: {
    coveredWeek: "Tydzień do pokrycia: {{range}}",
    freezesAvailable_one: "{{count}} zamrożenie dostępne",
    freezesAvailable_few: "{{count}} zamrożenia dostępne",
    freezesAvailable_many: "{{count}} zamrożeń dostępnych",
    freezesAvailable_other: "{{count}} zamrożenia dostępne",
    restoreAvailable: "Jednorazowe przywrócenie dostępne",
  },
  actions: {
    useFreeze: "Użyj zamrożenia",
    useRestore: "Użyj jednorazowego przywrócenia",
    startWorkoutInstead: "Zamiast tego zacznij trening",
    startComebackWorkout: "Zacznij trening powrotny",
    startWorkout: "Zacznij trening",
    adjustPlan: "Dostosuj mój plan",
    startFresh: "Zacznij nową serię",
    notNow: "Nie teraz",
    gotIt: "Rozumiem",
  },
  pro: {
    hint: "Pro zawiera comiesięczne zamrożenia serii.",
    link: "Dowiedz się o Pro",
  },
  restartConfirm: {
    title: "Zacząć nową serię?",
    body: "Liczenie serii zacznie się od nowa od Twojego następnego treningu. Historia treningów pozostaje bez zmian.",
    confirm: "Tak, zacznij od nowa",
    cancel: "Wróć",
  },
  feedback: {
    protectionApplied: "Zeszły tydzień jest pokryty. Seria trwa dalej.",
    restarted: "Nowy start — seria zaczyna się od Twojego następnego treningu.",
  },
  errors: {
    actionFailed:
      "Nie udało się zaktualizować serii. Twoje treningi są bezpieczne — spróbuj ponownie.",
  },
} as const;
