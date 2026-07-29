export const common = {
  nav: {
    home: "Home",
    calendar: "Calendar",
    profile: "Profile",
    modal: "Modal",
    designSystem: "Design System",
  },
  action: {
    goToHome: "Go to home screen",
    learnMore: "Learn more",
    share: "Share",
    delete: "Delete",
    action: "Action",
  },
  alert: {
    actionPressed: "Action pressed",
    sharePressed: "Share pressed",
    deletePressed: "Delete pressed",
  },
  media: {
    exerciseIllustration: "{{exerciseName}} illustration",
  },
  sync: {
    syncing: "Saving changes…",
    offline: "Saved on this device. We'll sync when you're back online.",
    failed: "Your data is safe on this device, but couldn't sync.",
    failedAgain: "Still unable to sync. Your data remains safe on this device.",
    recovered: "Your data is saved to your account.",
    retry: "Retry",
    retrying: "Retrying",
    support: "Contact support",
    reference: "Reference {{reference}}",
  },
} as const;
