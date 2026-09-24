export const feedback = {
  sync: {
    title: "Problem z synchronizacją danych treningowych",
    description:
      "Moje dane treningowe nadal się nie synchronizują.\n\nNumer diagnostyczny: {{reference}}",
  },
  header: {
    title: "Opinie",
    subtitle: "Pomóż nam ulepszać aplikację, zgłaszając błędy lub pomysły",
  },
  type: {
    title: "Jaki to rodzaj opinii?",
    bug: "Zgłoszenie błędu",
    feature: "Propozycja funkcji",
  },
  title: {
    label: "Tytuł",
    placeholder: "Krótkie podsumowanie opinii...",
  },
  description: {
    label: "Opis",
    subtitle: "Podaj jak najwięcej szczegółów",
    placeholder: "Opisz problem lub pomysł na funkcję...",
    charCount: "{{count}}/{{max}} znaków",
  },
  submit: {
    button: "Wyślij opinię",
    sending: "Wysyłanie...",
  },
  success: {
    title: "Dziękujemy!",
    message: "Otrzymaliśmy Twoją opinię. Wkrótce ją przejrzymy.",
    button: "Gotowe",
  },
  error: {
    title: "Błąd",
    message: "Nie udało się wysłać opinii. Spróbuj ponownie.",
  },
  validation: {
    titleRequired: "Tytuł jest wymagany",
    titleTooLong: "Tytuł musi mieć mniej niż 100 znaków",
    descriptionRequired: "Opis jest wymagany",
    descriptionTooLong: "Opis musi mieć mniej niż 2000 znaków",
  },
} as const;
