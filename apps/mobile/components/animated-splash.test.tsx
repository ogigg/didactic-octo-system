import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

import { AnimatedSplash } from "./animated-splash";

const mockHideAsync = jest.fn(() => Promise.resolve());

jest.mock("expo-splash-screen", () => ({
  hideAsync: () => mockHideAsync(),
}));

jest.mock("expo-haptics", () => ({
  ImpactFeedbackStyle: { Light: "light" },
  impactAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "light"),
}));

jest.mock("react-native-reanimated", () => {
  const Reanimated = require("react-native-reanimated/mock");
  const withTiming = Reanimated.withTiming;
  Reanimated.useReducedMotion = jest.fn(() => false);
  Reanimated.withTiming = jest.fn(
    (value: number, config?: object, callback?: Function) => {
      callback?.(true);
      return withTiming(value, config);
    }
  );
  return Reanimated;
});

describe("AnimatedSplash", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockHideAsync.mockClear();
    const { useReducedMotion } = require("react-native-reanimated");
    useReducedMotion.mockReturnValue(false);
    const { withTiming } = require("react-native-reanimated");
    withTiming.mockClear();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("waits for app readiness, the minimum display time, and layout", async () => {
    const onFinish = jest.fn();
    const view = render(
      <AnimatedSplash appReady={false} onFinish={onFinish} />
    );

    await act(async () => {
      fireEvent(
        view.getByTestId("animated-splash", { includeHiddenElements: true }),
        "layout"
      );
      await Promise.resolve();
    });
    act(() => jest.advanceTimersByTime(1000));
    expect(onFinish).not.toHaveBeenCalled();

    view.rerender(<AnimatedSplash appReady onFinish={onFinish} />);
    await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
    expect(mockHideAsync).toHaveBeenCalledTimes(1);
  });

  it("does not unmount before the native splash handoff", async () => {
    const onFinish = jest.fn();
    const view = render(<AnimatedSplash appReady onFinish={onFinish} />);

    act(() => jest.advanceTimersByTime(1000));
    expect(onFinish).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent(
        view.getByTestId("animated-splash", { includeHiddenElements: true }),
        "layout"
      );
      await Promise.resolve();
    });
    await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
  });

  it("finishes without timers or animation when reduced motion is enabled", async () => {
    const { useReducedMotion } = require("react-native-reanimated");
    useReducedMotion.mockReturnValue(true);
    const onFinish = jest.fn();
    const view = render(<AnimatedSplash appReady onFinish={onFinish} />);

    await act(async () => {
      fireEvent(
        view.getByTestId("animated-splash", { includeHiddenElements: true }),
        "layout"
      );
      await Promise.resolve();
    });

    await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
    expect(mockHideAsync).toHaveBeenCalledTimes(1);
    const { withTiming } = require("react-native-reanimated");
    expect(withTiming).toHaveBeenCalled();
    expect(
      withTiming.mock.calls.every(
        ([value, config]: [number, { duration?: number }]) =>
          value === 1 && config.duration === 0
      )
    ).toBe(true);
  });
});
