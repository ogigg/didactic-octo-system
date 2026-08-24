jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));

jest.mock("react-native-reanimated", () => {
  const Reanimated = require("react-native-reanimated/mock");
  Reanimated.useReducedMotion = jest.fn(() => true);
  return Reanimated;
});

jest.mock("react-native-gesture-handler", () => {
  const { View } = require("react-native");
  const mockGesture = {
    onChange: jest.fn(),
    onEnd: jest.fn(),
  };
  mockGesture.onChange.mockReturnValue(mockGesture);
  mockGesture.onEnd.mockReturnValue(mockGesture);

  return {
    GestureHandlerRootView: View,
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
    Gesture: {
      Pan: jest.fn(() => mockGesture),
    },
  };
});

import { createRef } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Keyboard, KeyboardAvoidingView, Platform, Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppBottomSheet, type AppBottomSheetHandle } from "../app-bottom-sheet";

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

describe("AppBottomSheet", () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: originalOS,
    });
  });

  it("dismisses before running a selected action", () => {
    const events: string[] = [];
    const ref = createRef<AppBottomSheetHandle>();

    render(
      <SafeAreaProvider initialMetrics={initialMetrics}>
        <AppBottomSheet
          ref={ref}
          visible
          onClose={() => events.push("close")}
          closeAccessibilityLabel="Close sheet"
        >
          <Text>Sheet content</Text>
        </AppBottomSheet>
      </SafeAreaProvider>
    );

    act(() => {
      ref.current?.dismiss(() => events.push("action"));
    });

    expect(events).toEqual(["close", "action"]);
  });

  it("dismisses when the backdrop is pressed", () => {
    const onClose = jest.fn();
    render(
      <SafeAreaProvider initialMetrics={initialMetrics}>
        <AppBottomSheet
          visible
          onClose={onClose}
          closeAccessibilityLabel="Close sheet"
        >
          <Text>Sheet content</Text>
        </AppBottomSheet>
      </SafeAreaProvider>
    );

    fireEvent.press(
      screen.getByLabelText("Close sheet", { includeHiddenElements: true })
    );

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("supports a compact fixed height", () => {
    render(
      <SafeAreaProvider initialMetrics={initialMetrics}>
        <AppBottomSheet
          visible
          onClose={jest.fn()}
          closeAccessibilityLabel="Close sheet"
          height="72%"
          testID="compact-sheet"
        >
          <Text>Sheet content</Text>
        </AppBottomSheet>
      </SafeAreaProvider>
    );

    expect(screen.getByTestId("compact-sheet")).toHaveStyle({
      height: "72%",
    });
  });

  it("dismisses the keyboard before closing from the backdrop", () => {
    const onClose = jest.fn();
    jest.spyOn(Keyboard, "isVisible").mockReturnValue(true);
    const dismissKeyboard = jest.spyOn(Keyboard, "dismiss");

    render(
      <SafeAreaProvider initialMetrics={initialMetrics}>
        <AppBottomSheet
          visible
          onClose={onClose}
          closeAccessibilityLabel="Close sheet"
        >
          <Text>Sheet content</Text>
        </AppBottomSheet>
      </SafeAreaProvider>
    );

    fireEvent.press(
      screen.getByLabelText("Close sheet", { includeHiddenElements: true })
    );

    expect(dismissKeyboard).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it.each([
    ["ios", "padding"],
    ["android", "height"],
  ] as const)("avoids the keyboard on %s", (platform, behavior) => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: platform,
    });

    const { UNSAFE_getByType } = render(
      <SafeAreaProvider initialMetrics={initialMetrics}>
        <AppBottomSheet
          visible
          onClose={jest.fn()}
          closeAccessibilityLabel="Close sheet"
        >
          <Text>Sheet content</Text>
        </AppBottomSheet>
      </SafeAreaProvider>
    );

    expect(UNSAFE_getByType(KeyboardAvoidingView)).toHaveProp(
      "behavior",
      behavior
    );
  });
});
