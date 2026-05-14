export const generateWorkout = {
  header: {
    title: "Ustaw swój trening",
    back: "Wróć",
  },
  frequencyBanner: {
    label: "Trenujesz {{frequency}}x w tygodniu",
  },
  trainingSplit: {
    title: "Podział treningu",
    fullBody: "Całe ciało",
    upperLower: "Góra / dół",
    pushPullLegs: "Push / Pull / Nogi",
    recommended: "Polecane",
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
  generate: {
    button: "Zacznij trening",
    loading: "Generowanie treningu...",
    cancel: "Anuluj",
    error: "Nie udało się rozpocząć treningu. Spróbuj ponownie.",
  },
} as const;
