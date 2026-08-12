export const deleteAccount = {
  header: {
    title: "Delete Account",
  },
  accessibility: {
    back: "Go back",
  },
  warning: {
    title: "Grace period: 14 days",
    body: "Your account will be scheduled for deletion. You have 14 days to change your mind — simply sign back in and your account is restored. After that, your account data is permanently deleted and cannot be recovered.",
  },
  retention: {
    heading: "What remains after deletion",
    body: "After 14 days, your sign-in account and user-owned app data are deleted from the app database and cannot be restored. Apple or Google may keep purchase and billing records under their own policies.",
  },
  subscription: {
    heading: "Subscription cancellation",
    body: "Deleting your account does not cancel subscriptions billed by the App Store or Google Play. Cancel any active subscription separately.",
  },
  consequences: {
    heading: "What gets deleted after 14 days",
    items: {
      account: "Your account and login credentials",
      history: "All workout history, sessions, and progression data",
      measurements: "Body measurements and tracked metrics",
      preferences: "Training preferences, baselines, and goals",
    },
  },
  confirm: {
    heading: "Confirm deletion",
    instruction: "Type {{phrase}} below to enable the delete button.",
    ariaLabel: "Deletion confirmation, destructive action",
  },
  finalConfirm: {
    title: "Schedule account deletion?",
    message:
      "You'll be signed out of every device. Sign back in within 14 days to cancel; after that, your sign-in account and user-owned app data cannot be recovered. Store billing continues until cancelled, and Apple or Google may keep their purchase records.",
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
    accessibilityLabel: "Schedule account deletion, destructive action",
    deleting: "Scheduling…",
    cancel: "Cancel",
  },
  error: {
    title: "Couldn't schedule deletion",
    message: "Something went wrong. Please try again or contact support.",
  },
} as const;
