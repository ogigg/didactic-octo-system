export const profile = {
  title: "Profile",
  subtitle: "Your training at a glance",
  stats: {
    trainingsCompleted: "TRAININGS COMPLETED",
    loadFailed: "We couldn't load this. Pull down to refresh.",
  },
  chart: {
    title: "Weekly Duration",
    subtitle: "Last 12 weeks",
    unitMinutes: "min",
  },
  sections: {
    tracking: "Tracking",
    settings: "Training",
    devices: "Devices",
    account: "Account",
  },
  nav: {
    subscription: "Subscription",
    statistics: "Statistics",
    calendar: "Calendar",
    measures: "Measures",
    history: "History",
    trainingPreferences: "Preferences",
    strengthBaselines: "Strength",
    health: "Health",
    watch: "Apple Watch",
    feedback: "Feedback",
    accountData: "Account & Data",
  },
  language: {
    label: "Language",
    english: "English",
    polish: "Polski",
    accessibility: "Change app language to {{language}}",
  },
  theme: {
    label: "Appearance",
    options: {
      system: "Auto",
      light: "Light",
      dark: "Dark",
    },
    accessibility: {
      system: "Match the device appearance",
      light: "Always use the light appearance",
      dark: "Always use the dark appearance",
    },
  },
} as const;
