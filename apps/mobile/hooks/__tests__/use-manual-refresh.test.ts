import { act, renderHook } from "@testing-library/react-native";

import { useManualRefresh } from "../use-manual-refresh";

describe("useManualRefresh", () => {
  it("stays refreshing until the refresh settles", async () => {
    let resolveRefresh!: () => void;
    const refresh = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRefresh = resolve;
        })
    );
    const { result } = renderHook(() => useManualRefresh(refresh));

    let refreshPromise!: Promise<void>;
    act(() => {
      refreshPromise = result.current.onRefresh();
    });

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(result.current.refreshing).toBe(true);

    await act(async () => {
      resolveRefresh();
      await refreshPromise;
    });

    expect(result.current.refreshing).toBe(false);
  });

  it("clears the refreshing state when the refresh rejects", async () => {
    const refresh = jest.fn(() => Promise.reject(new Error("offline")));
    const { result } = renderHook(() => useManualRefresh(refresh));

    await act(async () => {
      await expect(result.current.onRefresh()).rejects.toThrow("offline");
    });

    expect(result.current.refreshing).toBe(false);
  });
});
