export const generateWorkout = {
  header: {
    title: "Ustaw swoj trening",
    back: "Wroc",
  },
  frequencyBanner: {
    label: "Trenujesz {{frequency}}x w tygodniu",
  },
  trainingSplit: {
    title: "Podzial treningu",
    fullBody: "Cale cialo",
    upperLower: "Gora / dol",
    pushPullLegs: "Push / Pull / Nogi",
    recommended: "Polecane",
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
  generate: {
    button: "Zacznij trening",
    loading: "Generowanie treningu...",
    cancel: "Anuluj",
    error: "Nie udalo sie rozpoczac treningu. Sprobuj ponownie.",
  },
} as const;
