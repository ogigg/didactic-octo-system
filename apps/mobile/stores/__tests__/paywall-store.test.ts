import { act, renderHook } from "@testing-library/react-native";

import { usePaywallStore } from "../paywall-store";

beforeEach(() => {
  act(() => usePaywallStore.getState().close());
});

describe("paywall store", () => {
  it("stores usage context and a default generation-limit source", () => {
    const { result } = renderHook(() => usePaywallStore());

    act(() => result.current.open(5, 5));

    expect(result.current.isOpen).toBe(true);
    expect(result.current.usedCount).toBe(5);
    expect(result.current.limitCount).toBe(5);
    expect(result.current.source).toBe("generation_limit");
  });

  it("preserves an explicit paywall source", () => {
    const { result } = renderHook(() => usePaywallStore());

    act(() => result.current.open(2, 5, "subscription"));

    expect(result.current.source).toBe("subscription");
  });

  it("closes the paywall without losing usage context", () => {
    const { result } = renderHook(() => usePaywallStore());

    act(() => result.current.open(5, 5));
    act(() => result.current.close());

    expect(result.current.isOpen).toBe(false);
    expect(result.current.usedCount).toBe(5);
    expect(result.current.limitCount).toBe(5);
  });
});
