jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: { count?: number }) => {
      if (key === "filters.selectedCount") {
        return `${values?.count ?? 0} selected`;
      }
      if (key === "filters.showResults") {
        return `Show ${values?.count ?? 0} exercises`;
      }
      return (
        {
          "filters.closeSheet": "Close",
          "filters.loadingOptions": "Loading filters...",
          "filters.loadError": "Could not load filters.",
          "filters.retry": "Try again",
          "filters.emptyOptions": "No filters are available.",
          "filters.noMatchingOptions": "No matching equipment.",
          "filters.reset": "Reset all",
          "filters.showResultsLoading": "Show exercises",
          "filters.optionSearchPlaceholder": "Search equipment...",
          "filters.clearOptionSearch": "Clear equipment search",
        }[key] ?? key
      );
    },
  }),
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
  const onApply = jest.fn();
  const onClose = jest.fn();
  const onDraftChange = jest.fn();
  const onRetry = jest.fn();

  const props = {
    visible: true,
    onClose,
    title: "Muscle Group",
    options: ["chest", "back"],
    selected: [],
    displayLabels,
    onApply,
    onDraftChange,
    onRetry,
    resultCount: 2,
    ...overrides,
  };

  const result = render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <FilterSheet {...props} />
    </SafeAreaProvider>
  );

  return { ...result, onApply, onClose, onDraftChange, onRetry, props };
}

describe("FilterSheet", () => {
  it("renders localized options and the current selection count", () => {
    renderSheet();

    expect(screen.getByText("Muscle Group")).toBeOnTheScreen();
    expect(screen.getByText("Chest")).toBeOnTheScreen();
    expect(screen.getByText("back")).toBeOnTheScreen();
    expect(screen.getByText("0 selected")).toBeOnTheScreen();
  });

  it("keeps changes in a draft until Apply is pressed", () => {
    const { onApply, onClose } = renderSheet();

    fireEvent.press(screen.getByLabelText("Chest"));

    expect(screen.getByLabelText("Chest")).toHaveAccessibilityState({
      checked: true,
    });
    expect(screen.getByText("1 selected")).toBeOnTheScreen();
    expect(onApply).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.press(screen.getByRole("button", { name: "Show 2 exercises" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith(["chest"]);
  });

  it("discards draft changes when the backdrop closes the sheet", () => {
    const { onApply, onClose } = renderSheet();

    fireEvent.press(screen.getByLabelText("Chest"));
    fireEvent.press(
      screen.getByLabelText("Close", { includeHiddenElements: true })
    );

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
  });

  it("resets the draft before applying", () => {
    const { onApply } = renderSheet({ selected: ["chest"] });

    expect(screen.getByText("1 selected")).toBeOnTheScreen();
    fireEvent.press(screen.getByRole("button", { name: "Reset all" }));
    expect(screen.getByText("0 selected")).toBeOnTheScreen();
    fireEvent.press(screen.getByRole("button", { name: "Show 2 exercises" }));

    expect(onApply).toHaveBeenCalledWith([]);
  });

  it("shows a loading state while options are unavailable", () => {
    renderSheet({ isLoading: true, options: [] });

    expect(screen.getByText("Loading filters...")).toBeOnTheScreen();
    expect(screen.queryByLabelText("Chest")).not.toBeOnTheScreen();
    expect(
      screen.getByRole("button", { name: "Show 2 exercises" })
    ).toBeDisabled();
  });

  it("offers a retry when loading fails", () => {
    const { onRetry } = renderSheet({ isError: true, options: [] });

    expect(screen.getByText("Could not load filters.")).toBeOnTheScreen();
    fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders a clear empty state", () => {
    renderSheet({ options: [] });

    expect(screen.getByText("No filters are available.")).toBeOnTheScreen();
  });

  it("searches long equipment lists without changing the selection", () => {
    renderSheet({
      options: [
        "barbell",
        ...Array.from({ length: 15 }, (_, index) => `machine-${index}`),
      ],
      searchThreshold: 15,
    });

    fireEvent.changeText(screen.getByLabelText("Search equipment..."), "bar");

    expect(screen.getByText("Barbell")).toBeOnTheScreen();
    expect(screen.queryByText("machine-1")).not.toBeOnTheScreen();
  });

  it("previews a filter combination with no matching exercises", () => {
    renderSheet({ resultCount: 0 });

    expect(
      screen.getByRole("button", { name: "Show 0 exercises" })
    ).toBeEnabled();
  });
});
