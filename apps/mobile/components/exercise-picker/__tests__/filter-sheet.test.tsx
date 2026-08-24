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

jest.mock("@/components/ui/icon-symbol", () => {
  const React = require("react");
  const { Text } = require("react-native");

  return {
    IconSymbol: ({ name }: { name: string }) =>
      React.createElement(Text, null, name),
  };
});

import { fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { FilterSheet } from "../filter-sheet";

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const displayLabels = new Map([
  ["chest", "Chest"],
  ["barbell", "Barbell"],
]);

function renderSheet(overrides?: Partial<Parameters<typeof FilterSheet>[0]>) {
  const onToggle = jest.fn();
  const onClose = jest.fn();

  render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <FilterSheet
        visible
        onClose={onClose}
        title="Muscle Group"
        closeAccessibilityLabel="Close"
        loadingLabel="Loading filters..."
        options={["chest", "back"]}
        selected={[]}
        displayLabels={displayLabels}
        onToggle={onToggle}
        {...overrides}
      />
    </SafeAreaProvider>
  );

  return { onToggle, onClose };
}

describe("FilterSheet", () => {
  it("renders localized option labels", () => {
    renderSheet();

    expect(screen.getByText("Muscle Group")).toBeOnTheScreen();
    expect(screen.getByText("Chest")).toBeOnTheScreen();
    expect(screen.getByText("back")).toBeOnTheScreen();
  });

  it("toggles an option without closing the sheet", () => {
    const { onToggle, onClose } = renderSheet();

    fireEvent.press(screen.getByLabelText("Chest"));

    expect(onToggle).toHaveBeenCalledWith("chest");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("marks selected options as checked", () => {
    renderSheet({ selected: ["chest"] });

    expect(screen.getByLabelText("Chest")).toHaveAccessibilityState({
      checked: true,
    });
    expect(screen.getByLabelText("back")).toHaveAccessibilityState({
      checked: false,
    });
  });

  it("exposes the close control through its accessibility label", () => {
    renderSheet();

    expect(
      screen.getByLabelText("Close", { includeHiddenElements: true })
    ).toBeOnTheScreen();
  });

  it("shows a loading state while options are unavailable", () => {
    renderSheet({ isLoading: true, options: [] });

    expect(screen.getByText("Loading filters...")).toBeOnTheScreen();
    expect(screen.queryByLabelText("Chest")).not.toBeOnTheScreen();
  });
});
