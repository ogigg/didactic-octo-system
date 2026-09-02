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
  password: {
    label: "Password",
    setLabel: "Set password",
    changeLabel: "Change password",
    description: "Add or update email and password sign-in.",
    header: "Password",
    setTitle: "Set a password",
    changeTitle: "Change your password",
    setBody:
      "Add email and password sign-in without disconnecting your existing sign-in method.",
    changeBody: "Choose a new password for your account.",
    emailLabel: "Login email",
    appleNote:
      "Sign in with Apple will keep working. Use the login email above with your new password.",
    newPasswordLabel: "New password",
    confirmPasswordLabel: "Confirm new password",
    placeholder: "••••••••",
    setButton: "Set password",
    changeButton: "Change password",
    successSet: "Password set. You can now sign in with email too.",
    successChanged: "Password changed.",
    reauthApple: "For security, confirm with Apple before trying again.",
    reauthAppleButton: "Confirm with Apple",
    reauthCode:
      "For security, enter the code sent to your login email, then try again.",
    reauthCodeLabel: "Security code",
    reauthCodePlaceholder: "6-digit code",
    requestNewCode: "Send a new code",
    loading: "Loading account",
    errors: {
      load: "We couldn't load your account. Please try again.",
      weak: "Choose a stronger password and try again.",
      same: "Your new password must be different from your current password.",
      session: "Your session has expired. Sign in again to continue.",
      reauth: "We couldn't confirm your identity. Please try again.",
      code: "That security code is invalid or expired. Request a new one.",
      generic: "We couldn't update your password. Please try again.",
      accountMismatch:
        "The Apple account does not match your signed-in account.",
    },
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
