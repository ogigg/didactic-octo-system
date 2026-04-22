export const deleteAccount = {
  header: {
    title: "Delete Account",
  },
  warning: {
    title: "Grace period: 14 days",
    body: "Your account will be scheduled for deletion. You have 14 days to change your mind — simply sign back in and your account is restored. After that, everything is permanently erased.",
  },
  consequences: {
    heading: "What gets deleted after 14 days",
    items: {
      account: "Your account, login credentials, and subscription",
      history: "All workout history, sessions, and progression data",
      measurements: "Body measurements and tracked metrics",
      preferences: "Training preferences, baselines, and goals",
    },
  },
  confirm: {
    heading: "Confirm deletion",
    instruction: "Type {{phrase}} below to enable the delete button.",
    ariaLabel: "Deletion confirmation",
  },
  finalConfirm: {
    title: "Schedule account deletion?",
    message:
      "You'll be signed out of every device. Sign back in within 14 days to cancel — otherwise, all your data is permanently erased.",
    confirm: "Schedule Deletion",
    cancel: "Cancel",
  },
  scheduled: {
    title: "Deletion scheduled",
    message:
      "Your account is scheduled for permanent deletion in {{days}} days (on {{date}}). Sign back in anytime before then to cancel.",
    button: "OK",
  },
  cta: {
    delete: "Schedule Account Deletion",
    deleting: "Scheduling…",
    cancel: "Cancel",
  },
  error: {
    title: "Couldn't schedule deletion",
    message: "Something went wrong. Please try again or contact support.",
  },
} as const;
