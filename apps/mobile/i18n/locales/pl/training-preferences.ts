export const trainingPreferences = {
  header: {
    title: "Preferencje treningowe",
  },
  weightUnit: {
    title: "Jednostka wagi",
  },
  trainingSplit: {
    title: "Podzial treningu",
    fullBody: "Cale cialo",
    upperLower: "Gora / dol",
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
    title: "Sprzet",
    bodyweight: "Masa ciala",
    dumbbells: "Hantle",
    barbell: "Sztanga",
    fullGym: "Pelna silownia",
  },
  trainingStyle: {
    title: "Styl treningu",
    strength: "Sila",
    hypertrophy: "Hipertrofia",
    endurance: "Wytrzymalosc",
    circuit: "Obwodowy",
  },
  difficulty: {
    title: "Poziom",
    beginner: "Poczatkujacy",
    intermediate: "Sredniozaawansowany",
    advanced: "Zaawansowany",
  },
  prompt: {
    title: "Cel treningowy",
    subtitle: "Opcjonalnie - pokieruje przyszlymi treningami",
    placeholder: "np. Chce nauczyc sie muscle up...",
    charCount: "{{count}}/{{max}}",
  },
  promptSuggestions: {
    trainForMuscleUp: "Trening pod muscle up",
    strengthenLowerBack: "Wzmocnic dol plecow",
    improveRunningEndurance: "Poprawic wytrzymalosc biegowa",
    buildBiggerArms: "Zbudowac wieksze ramiona",
  },
  save: {
    button: "Zapisz preferencje",
    saving: "Zapisywanie...",
  },
  rebuildWarning: {
    title: "Wygenerowac treningi ponownie?",
    message:
      "Nadchodzace treningi zostana zastapione na podstawie nowych preferencji.",
    confirm: "Wygeneruj wszystkie",
    cancel: "Anuluj",
  },
  success: "Preferencje zapisane! Treningi sa generowane ponownie.",
  error: "Nie udalo sie zapisac preferencji. Sprobuj ponownie.",
} as const;
