export const accountSettings = {
  header: {
    title: "Account & Data",
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
  },
  difference: {
    title: "These actions are different",
    body: "Signing out only ends your current session. Cancelling a subscription stops future billing but keeps your account. Deleting your account removes your profile and training data, but does not cancel subscriptions billed by the App Store or Google Play.",
  },
  deletion: {
    label: "Delete account",
    description: "Review permanent data deletion and the 14-day grace period.",
    accessibilityLabel: "Delete account, destructive action",
  },
} as const;
