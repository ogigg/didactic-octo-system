export const streakProtection = {
  eyebrow: "Tygodniowa seria",
  closeSheet: "Zamknij opcje serii",
  states: {
    none: {
      title: "Seria na dobrej drodze",
      body: "Trenuj dalej we własnym tempie.",
    },
    at_risk: {
      title: "Seria {{count}} tyg. wciąż trwa",
      body: "Jeden trening w tym tygodniu ją utrzyma. Każdy się liczy.",
    },
    free_earned_freeze: {
      title: "Użyć zamrożenia na zeszły tydzień?",
      body: "Zdobyłeś je, trenując tydzień po tygodniu. Wypełni lukę i seria zostanie cała. Możesz też je pominąć i zacząć od nowa — Twój wybór.",
    },
    free_lifetime_rescue: {
      title: "Wypełnić lukę z zeszłego tygodnia?",
      body: "Jednorazowe przywrócenie pokryje opuszczony tydzień i seria zostanie cała. Trening w tym tygodniu i start od nowa są równie dobre.",
    },
    free_comeback: {
      title: "Dobrze Cię widzieć",
      body: "Zeszły tydzień był odpoczynkiem, więc licznik startuje od zera. Wszystko, co zapisałeś, zostaje. Krótki trening to najprostszy powrót.",
    },
    pro_auto_applied: {
      title: "Zeszły tydzień jest pokryty",
      body_one:
        "Zamrożenie Pro wypełniło lukę za Ciebie. Zostało {{count}} zamrożenie.",
      body_few:
        "Zamrożenie Pro wypełniło lukę za Ciebie. Zostały {{count}} zamrożenia.",
      body_many:
        "Zamrożenie Pro wypełniło lukę za Ciebie. Zostało {{count}} zamrożeń.",
      body_other:
        "Zamrożenie Pro wypełniło lukę za Ciebie. Zostało {{count}} zamrożenia.",
    },
    pro_available_freeze: {
      title: "Użyć zamrożenia na zeszły tydzień?",
      body: "Wypełni lukę i seria zostanie cała. Możesz też je pominąć i zacząć od nowa — Twój wybór.",
    },
    pro_comeback: {
      title: "Dobrze Cię widzieć",
      body: "Na zeszły tydzień nie zostało żadne zamrożenie, więc licznik startuje od zera. Wszystko, co zapisałeś, zostaje. Wróć spokojnie albo odchudź plan, jeśli tygodnie są za pełne.",
    },
  },
  details: {
    coveredWeek: "Obejmuje {{range}}",
    freezesAvailable_one: "Zostało {{count}} zamrożenie",
    freezesAvailable_few: "Zostały {{count}} zamrożenia",
    freezesAvailable_many: "Zostało {{count}} zamrożeń",
    freezesAvailable_other: "Zostało {{count}} zamrożenia",
    restoreAvailable: "Jednorazowe przywrócenie, niewykorzystane",
  },
  actions: {
    useFreeze: "Użyj zamrożenia",
    useRestore: "Użyj przywrócenia",
    startWorkoutInstead: "Wolę trenować",
    startComebackWorkout: "Zacznij trening",
    startWorkout: "Zacznij trening",
    adjustPlan: "Dostosuj plan",
    startFresh: "Zacznij od nowa",
    notNow: "Nie teraz",
    gotIt: "Rozumiem",
  },
  pro: {
    hint: "W Pro co miesiąc dostajesz zamrożenie.",
    link: "Zobacz Pro",
  },
  restartConfirm: {
    title: "Zacząć od nowa?",
    body: "Licznik wraca do zera i rośnie od Twojego następnego treningu. Wszystko, co zapisałeś, zostaje.",
    confirm: "Zacznij od nowa",
    cancel: "Wróć",
  },
  feedback: {
    protectionApplied: "Luka wypełniona. Seria nienaruszona.",
    restarted: "Nowy start. Liczymy od następnego treningu.",
  },
  errors: {
    actionFailed:
      "Nie udało się zapisać. Twoje treningi są nietknięte — spróbuj ponownie.",
  },
} as const;
