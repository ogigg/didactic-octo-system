export const exercisePreference = {
  sheet: {
    title: "Exercise Preference",
  },
  options: {
    preferred: "Preferred",
    preferredDescription: "Include this exercise more often in your workouts",
    softDislike: "Show Less",
    softDislikeDescription: "Include this exercise less frequently",
    hardDislike: "Never Show",
    hardDislikeDescription: "Exclude this exercise from all future workouts",
    remove: "Remove Preference",
  },
  header: {
    accessibilityLabel: "Set exercise preference",
  },
  status: {
    preferred: "Preferred",
    softDislike: "Show less",
    hardDislike: "Hidden",
  },
  menu: {
    preference: "Exercise preference",
  },
} as const;
