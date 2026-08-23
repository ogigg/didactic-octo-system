export const trainingPreferences = {
  header: {
    title: "Preferencje treningowe",
  },
  weightUnit: {
    title: "Jednostka wagi",
  },
  trainingSplit: {
    title: "Podział treningu",
    fullBody: "Całe ciało",
    upperLower: "Góra / dół",
    pushPullLegs: "Push / Pull / Nogi",
    recommended: "Polecane",
  },
  duration: {
    title: "Czas trwania",
    min15: "15 min",
    min30: "30 min",
    min45: "45 min",
    min60: "60 min",
    min90: "90 min",
  },
  equipment: {
    title: "Sprzęt",
    bodyweight: "Masa ciała",
    dumbbells: "Hantle",
    barbell: "Sztanga",
    fullGym: "Pełna siłownia",
  },
  trainingStyle: {
    title: "Styl treningu",
    strength: "Siła",
    hypertrophy: "Hipertrofia",
    endurance: "Wytrzymałość",
    circuit: "Obwodowy",
  },
  difficulty: {
    title: "Poziom",
    beginner: "Początkujący",
    intermediate: "Średniozaawansowany",
    advanced: "Zaawansowany",
  },
  weightIncrements: {
    title: "Skoki obciążenia",
    subtitle:
      "Dopasuj do talerzy lub kręgu na sprzęcie na Twojej siłowni, żeby progresja używała obciążeń, które faktycznie ustawisz.",
    equipment: {
      barbell: "Sztanga",
      dumbbell: "Hantle",
      machine: "Maszyna",
      cable: "Wyciąg",
    },
    baseStep: {
      title: "Krok obciążenia",
      auto: "Auto",
    },
    microStep: {
      title: "Dodatkowy mały krok",
      none: "Brak",
    },
    kg: "{{value}} kg",
  },
  prompt: {
    title: "Cel treningowy",
    subtitle: "Opcjonalnie - pokieruje przyszłymi treningami",
    placeholder: "np. Chcę nauczyć się muscle up...",
    charCount: "{{count}}/{{max}}",
  },
  promptSuggestions: {
    trainForMuscleUp: "Trening pod muscle up",
    strengthenLowerBack: "Wzmocnić dół pleców",
    improveRunningEndurance: "Poprawić wytrzymałość biegową",
    buildBiggerArms: "Zbudować większe ramiona",
  },
  save: {
    button: "Zapisz preferencje",
    saving: "Zapisywanie...",
  },
  rebuildWarning: {
    title: "Wygenerować treningi ponownie?",
    message:
      "Nadchodzące treningi zostaną zastąpione na podstawie nowych preferencji.",
    confirm: "Wygeneruj wszystkie",
    cancel: "Anuluj",
  },
  success: "Preferencje zapisane! Treningi są generowane ponownie.",
  error: "Nie udało się zapisać preferencji. Spróbuj ponownie.",
} as const;
