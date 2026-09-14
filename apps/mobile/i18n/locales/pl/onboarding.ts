export const onboarding = {
  actions: {
    continue: "Dalej",
    save: "Zapisz zmiany",
    back: "Wstecz",
    edit: "Zmień: {{field}}",
    create: "Przygotuj treningi",
    saving: "Zapisywanie ustawień…",
  },
  progress: {
    step: "Krok {{current}} z {{total}}",
    review: "Sprawdź ustawienia treningów",
  },
  goal: {
    title: "Co chcesz osiągnąć?",
    subtitle:
      "Dopasujemy treningi do twojego celu. W każdej chwili możesz go zmienić.",
    build_strength: "Zwiększyć siłę",
    build_muscle: "Rozbudować mięśnie",
    lose_weight: "Schudnąć",
    improve_fitness: "Poprawić ogólną sprawność",
    custom: "Możesz też wpisać własny cel",
    invalid: "Opisz cel w co najmniej 5 znakach, bez obraźliwych słów.",
  },
  equipment: {
    title: "Z jakiego sprzętu możesz korzystać?",
    subtitle:
      "Dobierzemy ćwiczenia do dostępnego sprzętu. Wybierz opcję, która najlepiej pasuje.",
    bodyweight: "Bez sprzętu",
    bodyweightHint: "Ćwiczenia z ciężarem własnego ciała",
    dumbbells: "Hantle",
    dumbbellsHint: "Para hantli w domu lub na siłowni",
    barbell: "Sztanga",
    barbellHint: "Sztanga z obciążeniem oraz stojak lub ławka",
    full_gym: "Sprzęt na siłowni",
    full_gymHint: "Hantle, sztangi, maszyny i wyciągi",
  },
  experience: {
    title: "Jakie masz doświadczenie w treningu?",
    subtitle:
      "Dzięki temu dobierzemy ćwiczenia i poziom trudności odpowiedni na początek.",
    beginner: "Zaczynam lub wracam po przerwie",
    beginnerHint: "Dopiero zaczynasz lub wracasz po długiej przerwie",
    intermediate: "Znam podstawy",
    intermediateHint:
      "Trenujesz regularnie i znasz technikę podstawowych ćwiczeń",
    advanced: "Mam duże doświadczenie",
    advancedHint:
      "Trenujesz według planu i wiesz, kiedy zwiększać ciężar lub liczbę powtórzeń",
  },
  frequency: {
    title: "Jak często chcesz trenować?",
    subtitle:
      "Wybierz, ile dni w tygodniu możesz ćwiczyć i ile czasu przeznaczysz na jeden trening.",
    days: "Ile dni w tygodniu?",
    once: "1 dzień",
    dayCount: "{{count}} dni",
    fivePlus: "5+ dni",
    fiveHint:
      "Możesz ćwiczyć pięć lub więcej dni w tygodniu. Na początek przygotujemy pięć treningów.",
    duration: "Ile czasu na jeden trening?",
    minutes: "{{count}} min",
  },
  review: {
    title: "Sprawdź ustawienia treningów",
    subtitle:
      "Na tej podstawie przygotujemy twoje treningi. Sprawdź odpowiedzi poniżej. Później możesz je zmienić w profilu.",
    goal: "Cel",
    equipment: "Sprzęt",
    experience: "Doświadczenie",
    schedule: "Częstotliwość i czas",
    scheduleValue: "{{days}} w tygodniu · {{minutes}} min na trening",
    split: "Podział treningów",
    style: "Rodzaj treningu",
    adjustStyle: "Zmień rodzaj treningu",
    constraints: "Co jeszcze warto uwzględnić? (opcjonalnie)",
    constraintsHint:
      "Napisz, jakich ćwiczeń chcesz unikać lub jakie masz ograniczenia ruchowe. Jeśli cię to nie dotyczy, zostaw pole puste.",
    constraintsPlaceholder: "Na przykład: bez ćwiczeń z podskokami",
    constraintsCount: "{{count}}/200",
    strengthLater:
      "Nie musisz jeszcze znać swoich ciężarów do ćwiczeń. Dobierzesz je podczas pierwszego treningu lub uzupełnisz później w profilu.",
    full_body: "Całe ciało",
    upper_lower: "Osobne treningi góry i dołu ciała",
    push_pull_legs: "Osobne treningi wypychania, przyciągania i nóg",
    strength: "Siła",
    hypertrophy: "Rozbudowa mięśni",
    endurance: "Wytrzymałość mięśniowa",
    circuit: "Trening obwodowy",
    error:
      "Nie udało się zapisać ustawień. Sprawdź połączenie i spróbuj ponownie. Nie musisz ponownie wpisywać odpowiedzi.",
  },
} as const;
