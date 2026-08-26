jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));
jest.mock("@/lib/track-event", () => ({ trackEvent: jest.fn() }));

import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { trackEvent } from "@/lib/track-event";
import { usePaywallStore } from "@/stores/paywall-store";
import { Paywall } from "../paywall";

beforeEach(() => {
  jest.clearAllMocks();
  act(() => usePaywallStore.getState().close());
});

describe("Paywall analytics", () => {
  it("tracks a view with source and usage context once per open", () => {
    render(<Paywall />);

    act(() => usePaywallStore.getState().open(5, 5, "generation_limit"));

    expect(trackEvent).toHaveBeenCalledWith("paywall_viewed", {
      source: "generation_limit",
      used_count: 5,
      limit_count: 5,
    });
  });

  it("tracks upgrade intent without free-text payloads", () => {
    render(<Paywall />);
    act(() => usePaywallStore.getState().open(5, 5, "generation_limit"));

    fireEvent.press(screen.getByRole("button", { name: "paywall.upgradeCta" }));

    expect(trackEvent).toHaveBeenCalledWith("upgrade_tapped", {
      source: "generation_limit",
      used_count: 5,
      limit_count: 5,
    });
  });

  it("tracks dismissals with source and usage context", () => {
    render(<Paywall />);
    act(() => usePaywallStore.getState().open(2, 5, "subscription"));

    fireEvent.press(screen.getByRole("button", { name: "paywall.dismiss" }));

    expect(trackEvent).toHaveBeenCalledWith("paywall_dismissed", {
      source: "subscription",
      used_count: 2,
      limit_count: 5,
    });
  });
});
