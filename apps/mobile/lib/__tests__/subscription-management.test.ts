import { Linking } from "react-native";

import {
  getSubscriptionManagementDestination,
  openSubscriptionManagement,
} from "../subscription-management";

const canOpenUrlSpy = jest.spyOn(Linking, "canOpenURL");
const openUrlSpy = jest.spyOn(Linking, "openURL");

describe("subscription management", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    canOpenUrlSpy.mockResolvedValue(true);
    openUrlSpy.mockResolvedValue(undefined);
  });

  it("uses the official Apple subscription management destination on iOS", () => {
    expect(getSubscriptionManagementDestination("ios")?.primaryUrl).toBe(
      "https://apps.apple.com/account/subscriptions"
    );
  });

  it("uses the official Google Play subscriptions destination on Android", () => {
    expect(getSubscriptionManagementDestination("android")?.primaryUrl).toBe(
      "https://play.google.com/store/account/subscriptions"
    );
  });

  it("opens the primary store management destination", async () => {
    await expect(openSubscriptionManagement("ios")).resolves.toBe(
      "https://apps.apple.com/account/subscriptions"
    );

    expect(openUrlSpy).toHaveBeenCalledWith(
      "https://apps.apple.com/account/subscriptions"
    );
  });

  it("falls back to official support when the store destination cannot open", async () => {
    canOpenUrlSpy.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    await expect(openSubscriptionManagement("android")).resolves.toBe(
      "https://support.google.com/googleplay/answer/7018481"
    );

    expect(openUrlSpy).toHaveBeenCalledWith(
      "https://support.google.com/googleplay/answer/7018481"
    );
  });

  it("rejects when neither destination can open", async () => {
    canOpenUrlSpy.mockResolvedValue(false);

    await expect(openSubscriptionManagement("ios")).rejects.toThrow(
      "Unable to open subscription management"
    );
  });
});
