export const healthSync = {
  prompt: {
    title: "Sync to Apple Health?",
    titleAndroid: "Sync to Health Connect?",
    message:
      "Sweaty can save your completed workouts so they show up alongside your other activity. We only write the workout type and its start and end time — your exercises, sets, and weights stay in Sweaty.",
    messageAndroid:
      "Sweaty can save your completed workouts to Health Connect. We only write the workout type and its start and end time — your exercises, sets, and weights stay in Sweaty.",
    allow: "Allow",
    notNow: "Not now",
  },
  priming: {
    title: "Sync with Apple Health",
    titleAndroid: "Sync with Health Connect",
    subtitle:
      "Connect your health data for a complete picture of your training.",
    subtitleAndroid:
      "Connect Health Connect to keep your training data in sync.",
    benefits: {
      heartRate: "Track heart rate during workouts",
      dashboard: "See workouts in your health dashboard",
      onePlace: "Keep all your fitness data in one place",
    },
    privacy:
      "We only read heart rate and write workout summaries. Your data stays private.",
    connect: "Connect",
    connecting: "Connecting\u2026",
    notNow: "Not Now",
  },
  settings: {
    title: "Health Integration",
    status: {
      connected: "Connected",
      notConnected: "Not Connected",
      notRequested: "Not Requested",
      restricted: "Restricted",
      skipped: "Declined",
      unavailable: "Not Available",
      unknown: "Not Set Up",
    },
    description:
      "Sweaty syncs completed workouts and reads heart rate data from your health platform.",
    descriptionAndroid: "Sweaty syncs completed workouts to Health Connect.",
    connectButton: "Connect",
    openSettingsButton: "Open Settings",
    recoveryButton: "How to Enable Access",
    recoveryTitle: "Enable Apple Health Access",
    recoveryInstructions:
      "Open the Health app, tap your profile picture, then tap Apps under Privacy. Select Sweaty and turn on the health categories you want to share.",
    recoveryDismiss: "Got It",
    recoveryHint:
      "Apple Health permissions are managed in the Health app. Tap above for the exact steps.",
    recoveryHintAndroid: "Grant permissions in Health Connect to enable sync.",
    restrictedHint:
      "Apple Health is restricted on this iPhone. If this is a managed device, contact your administrator.",
    resetButton: "Disconnect",
    resetConfirmTitle: "Disconnect Health?",
    resetConfirmMessage:
      "Sweaty will stop syncing workouts. Previously synced data will remain in your health app.",
    resetConfirmCancel: "Cancel",
    resetConfirmOk: "Disconnect",
    platformLabel: "Apple Health",
    platformLabelAndroid: "Health Connect",
  },
} as const;
