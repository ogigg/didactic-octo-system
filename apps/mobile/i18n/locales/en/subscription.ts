export const subscription = {
  badge: {
    pro: "pro",
  },
  usage: {
    label: "AI generations",
    count: "{{used}} / {{limit}}",
    weekly: "this week",
  },
  paywall: {
    title: "Weekly limit reached",
    subtitle: "{{used}} of {{limit}} generations used this week",
    benefitsTitle: "Upgrade to Pro",
    benefits: {
      unlimited: "Unlimited AI workouts",
      insights: "Advanced progress insights",
      priority: "Priority generation",
      focus: "Custom training focus",
    },
    upgradeCta: "Upgrade to Pro",
    dismiss: "Not now",
    comingSoon: "Pro subscriptions coming soon — stay tuned!",
  },
  screen: {
    title: "Subscription",
    backAccessibilityLabel: "Go back",
    currentPlan: {
      freeTitle: "Free plan",
      freeDescription: "5 AI generations per week",
      proTitle: "Pro plan",
      proDescription: "Unlimited AI generations",
      thisWeek: "This week",
    },
    benefitsTitle: "Unlock Pro",
    benefits: {
      unlimited: {
        title: "Unlimited AI workouts",
        description: "Generate as many workouts as you need",
      },
      insights: {
        title: "Advanced progress insights",
        description: "Strength curves and volume trends",
      },
      priority: {
        title: "Priority generation",
        description: "Faster AI response times",
      },
      focus: {
        title: "Custom training focus",
        description: "Target specific muscle groups",
      },
    },
    upgradeCta: "Upgrade to Pro",
    comingSoon: "Pro subscriptions coming soon — stay tuned!",
    management: {
      description:
        "Store subscriptions keep billing until you cancel them with Apple or Google Play.",
      button: "Manage Store Subscription",
      accessibilityLabel: "Manage store subscription",
      errorTitle: "Couldn't open subscription management",
      errorMessage:
        "Open your App Store or Google Play subscription settings to manage billing.",
    },
  },
} as const;
