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
      title: "Zachowaj swoją serię",
      body: "Za regularne treningi masz zamrożenie. Użyj go, by zachować serię mimo przerwy w zeszłym tygodniu, albo zacznij nową serię od kolejnego treningu.",
    },
    free_lifetime_rescue: {
      title: "Daj swojej serii kolejny tydzień",
      body: "Tydzień bez treningu? Możesz raz przywrócić serię po przerwie albo zacząć nową od kolejnego treningu.",
    },
    free_comeback: {
      title: "Czas na kolejny trening?",
      body: "Kolejny trening rozpocznie nową serię. Wszystkie poprzednie treningi są zapisane. Wróć do ćwiczeń, nawet jeśli dziś masz czas tylko na krótką sesję.",
    },
    pro_auto_applied: {
      title: "Twoja seria trwa dalej",
      body_one:
        "Pro automatycznie użyło zamrożenia za zeszły tydzień. Zostało {{count}} zamrożenie.",
      body_few:
        "Pro automatycznie użyło zamrożenia za zeszły tydzień. Zostały {{count}} zamrożenia.",
      body_many:
        "Pro automatycznie użyło zamrożenia za zeszły tydzień. Zostało {{count}} zamrożeń.",
      body_other:
        "Pro automatycznie użyło zamrożenia za zeszły tydzień. Zostało {{count}} zamrożenia.",
    },
    pro_available_freeze: {
      title: "Zachowaj swoją serię",
      body: "Użyj zamrożenia, by zachować serię mimo przerwy w zeszłym tygodniu, albo zacznij nową serię od kolejnego treningu.",
    },
    pro_comeback: {
      title: "Czas na kolejny trening?",
      body: "Nie było już zamrożeń na zeszły tydzień. Kolejny trening rozpocznie nową serię, a poprzednie treningi są zapisane. Masz mniej czasu na ćwiczenia? Dostosuj plan poniżej.",
    },
  },
  details: {
    coveredWeek: "Obejmuje {{range}}",
    freezesAvailable_one: "Zostało {{count}} zamrożenie",
    freezesAvailable_few: "Zostały {{count}} zamrożenia",
    freezesAvailable_many: "Zostało {{count}} zamrożeń",
    freezesAvailable_other: "Zostało {{count}} zamrożenia",
    restoreAvailable: "Dostępne jednorazowe przywrócenie",
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
