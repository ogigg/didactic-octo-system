export const deleteAccount = {
  header: {
    title: "Usuń konto",
  },
  accessibility: {
    back: "Wróć",
  },
  warning: {
    title: "Okres ochronny: 14 dni",
    body: "Twoje konto zostanie zaplanowane do usunięcia. Masz 14 dni, aby zmienić zdanie — wystarczy zalogować się ponownie, a konto zostanie przywrócone. Po tym czasie dane konta zostaną trwale usunięte i nie będzie można ich odzyskać.",
  },
  retention: {
    heading: "Co pozostaje po usunięciu",
    body: "Po 14 dniach konto logowania i dane aplikacji należące do użytkownika zostaną usunięte z bazy aplikacji bez możliwości przywrócenia. Apple lub Google mogą zachować dane zakupów i płatności zgodnie z własnymi zasadami.",
  },
  subscription: {
    heading: "Anulowanie subskrypcji",
    body: "Usunięcie konta nie anuluje subskrypcji rozliczanych przez App Store lub Google Play. Anuluj aktywną subskrypcję osobno.",
  },
  consequences: {
    heading: "Co zostanie usunięte po 14 dniach",
    items: {
      account: "Twoje konto i dane logowania",
      history: "Cała historia treningów, sesje i dane progresu",
      measurements: "Pomiary ciała i śledzone metryki",
      preferences: "Preferencje treningowe, poziomy siły i cele",
    },
  },
  confirm: {
    heading: "Potwierdź usunięcie",
    instruction: "Wpisz poniżej {{phrase}}, aby włączyć przycisk usuwania.",
    ariaLabel: "Potwierdzenie usunięcia",
  },
  finalConfirm: {
    title: "Zaplanować usunięcie konta?",
    message:
      "Zostaniesz wylogowany ze wszystkich urządzeń. Zaloguj się ponownie w ciągu 14 dni, aby anulować; później nie będzie można odzyskać konta logowania ani danych aplikacji należących do użytkownika. Opłaty w sklepie trwają do anulowania, a Apple lub Google mogą zachować dane zakupów.",
    confirm: "Zaplanuj usunięcie",
    cancel: "Anuluj",
  },
  scheduled: {
    title: "Usunięcie zaplanowane",
    message:
      "Twoje konto zostanie trwale usunięte za {{days}} dni ({{date}}). Zaloguj się przed tym terminem, aby anulować.",
    button: "OK",
  },
  cta: {
    delete: "Zaplanuj usunięcie konta",
    accessibilityLabel: "Zaplanuj usunięcie konta, działanie destrukcyjne",
    deleting: "Planowanie...",
    cancel: "Anuluj",
  },
  error: {
    title: "Nie udało się zaplanować usunięcia",
    message:
      "Coś poszło nie tak. Spróbuj ponownie albo skontaktuj się ze wsparciem.",
  },
} as const;
