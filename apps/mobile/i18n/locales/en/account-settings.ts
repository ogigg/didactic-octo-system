export const accountSettings = {
  header: {
    title: "Account & Data",
  },
  accessibility: {
    back: "Go back",
  },
  intro: {
    title: "Manage your account",
    body: "Review your subscription and account data options in one place.",
  },
  sections: {
    management: "Account management",
    deletion: "Data deletion",
  },
  subscription: {
    label: "Subscription",
    description: "Subscription status and billing are managed separately.",
    errorTitle: "Couldn't open subscription management",
    errorMessage:
      "Open your App Store or Google Play subscription settings to manage billing.",
  },
  difference: {
    title: "These actions are different",
    body: "Signing out only ends your current session. Cancelling a subscription stops future billing but keeps your account. Deleting your account removes your profile and training data, but does not cancel subscriptions billed by the App Store or Google Play.",
  },
  deletion: {
    label: "Delete account",
    description: "Review permanent data deletion and the 14-day grace period.",
    accessibilityLabel: "Delete account, destructive action",
    subscriptionWarning: {
      title: "Cancel store billing first?",
      message:
        "Deleting your account does not cancel an App Store or Google Play subscription. Manage billing first, or deliberately continue if you have already cancelled or accept that billing may continue.",
      cancel: "Not now",
      manage: "Manage Subscription",
      continue: "Continue to Deletion",
    },
  },
} as const;
