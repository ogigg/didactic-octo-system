export const deleteAccount = {
  header: {
    title: "Usun konto",
  },
  warning: {
    title: "Okres ochronny: 14 dni",
    body: "Twoje konto zostanie zaplanowane do usuniecia. Masz 14 dni, aby zmienic zdanie - wystarczy zalogowac sie ponownie, a konto zostanie przywrocone. Po tym czasie wszystko zostanie trwale usuniete.",
  },
  consequences: {
    heading: "Co zostanie usuniete po 14 dniach",
    items: {
      account: "Twoje konto, dane logowania i subskrypcja",
      history: "Cala historia treningow, sesje i dane progresu",
      measurements: "Pomiary ciala i sledzone metryki",
      preferences: "Preferencje treningowe, poziomy sily i cele",
    },
  },
  confirm: {
    heading: "Potwierdz usuniecie",
    instruction: "Wpisz ponizej {{phrase}}, aby wlaczyc przycisk usuwania.",
    ariaLabel: "Potwierdzenie usuniecia",
  },
  finalConfirm: {
    title: "Zaplanowac usuniecie konta?",
    message:
      "Zostaniesz wylogowany ze wszystkich urzadzen. Zaloguj sie ponownie w ciagu 14 dni, aby anulowac - w przeciwnym razie wszystkie dane zostana trwale usuniete.",
    confirm: "Zaplanuj usuniecie",
    cancel: "Anuluj",
  },
  scheduled: {
    title: "Usuniecie zaplanowane",
    message:
      "Twoje konto zostanie trwale usuniete za {{days}} dni ({{date}}). Zaloguj sie przed tym terminem, aby anulowac.",
    button: "OK",
  },
  cta: {
    delete: "Zaplanuj usuniecie konta",
    deleting: "Planowanie...",
    cancel: "Anuluj",
  },
  error: {
    title: "Nie udalo sie zaplanowac usuniecia",
    message:
      "Cos poszlo nie tak. Sprobuj ponownie albo skontaktuj sie ze wsparciem.",
  },
} as const;
