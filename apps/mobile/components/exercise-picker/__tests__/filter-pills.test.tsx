jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));

jest.mock("@/components/ui/icon-symbol", () => {
  const React = require("react");
  const { Text } = require("react-native");

  return {
    IconSymbol: ({ name }: { name: string }) =>
      React.createElement(Text, null, name),
  };
});

import { fireEvent, render, screen } from "@testing-library/react-native";

import { FilterPills } from "../filter-pills";

describe("FilterPills", () => {
  const defaultProps = {
    favoritesOnly: false,
    selectedMuscles: [] as string[],
    selectedEquipment: [] as string[],
    onPressFavorites: jest.fn(),
    onPressMuscles: jest.fn(),
    onPressEquipment: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lets the user quickly access favorites from search filters", () => {
    render(<FilterPills {...defaultProps} />);

    const favorites = screen.getByRole("button", { name: "filters.favorites" });
    expect(favorites.props.accessibilityState?.selected).toBe(false);

    fireEvent.press(favorites);

    expect(defaultProps.onPressFavorites).toHaveBeenCalledTimes(1);
  });

  it("marks the favorites filter as selected when it is active", () => {
    render(<FilterPills {...defaultProps} favoritesOnly />);

    const favorites = screen.getByRole("button", { name: "filters.favorites" });
    expect(favorites.props.accessibilityState?.selected).toBe(true);
    expect(screen.getByText("heart.fill")).toBeTruthy();
  });
});
