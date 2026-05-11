export const feedback = {
  header: {
    title: "Opinie",
    subtitle: "Pomoz nam ulepszac aplikacje, zglaszajac bledy lub pomysly",
  },
  type: {
    title: "Jaki to rodzaj opinii?",
    bug: "Zgloszenie bledu",
    feature: "Propozycja funkcji",
  },
  title: {
    label: "Tytul",
    placeholder: "Krotkie podsumowanie opinii...",
  },
  description: {
    label: "Opis",
    subtitle: "Podaj jak najwiecej szczegolow",
    placeholder: "Opisz problem lub pomysl na funkcje...",
    charCount: "{{count}}/{{max}} znakow",
  },
  submit: {
    button: "Wyslij opinie",
    sending: "Wysylanie...",
  },
  success: {
    title: "Dziekujemy!",
    message: "Otrzymalismy Twoja opinie. Wkrotce ja przejrzymy.",
    button: "Gotowe",
  },
  error: {
    title: "Blad",
    message: "Nie udalo sie wyslac opinii. Sprobuj ponownie.",
  },
  validation: {
    titleRequired: "Tytul jest wymagany",
    titleTooLong: "Tytul musi miec mniej niz 100 znakow",
    descriptionRequired: "Opis jest wymagany",
    descriptionTooLong: "Opis musi miec mniej niz 2000 znakow",
  },
} as const;
