import { Linking, Platform, type PlatformOSType } from "react-native";

interface SubscriptionManagementDestination {
  primaryUrl: string;
  fallbackUrl: string;
}

const SUBSCRIPTION_MANAGEMENT_DESTINATIONS: Partial<
  Record<PlatformOSType, SubscriptionManagementDestination>
> = {
  ios: {
    primaryUrl: "https://apps.apple.com/account/subscriptions",
    fallbackUrl: "https://support.apple.com/118428",
  },
  android: {
    primaryUrl: "https://play.google.com/store/account/subscriptions",
    fallbackUrl: "https://support.google.com/googleplay/answer/7018481",
  },
};

export function getSubscriptionManagementDestination(
  platform: PlatformOSType = Platform.OS
): SubscriptionManagementDestination | null {
  return SUBSCRIPTION_MANAGEMENT_DESTINATIONS[platform] ?? null;
}

export async function openSubscriptionManagement(
  platform: PlatformOSType = Platform.OS
): Promise<string> {
  const destination = getSubscriptionManagementDestination(platform);

  if (!destination) {
    throw new Error("Subscription management is unavailable on this platform");
  }

  for (const url of [destination.primaryUrl, destination.fallbackUrl]) {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        continue;
      }

      await Linking.openURL(url);
      return url;
    } catch {
      // Try the verified support destination before reporting a failure.
    }
  }

  throw new Error("Unable to open subscription management");
}
