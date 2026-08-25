jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: { filter?: string; query?: string }) => {
      if (key === "filters.removeFilter") return `Remove ${values?.filter}`;
      if (key === "filters.searchChip") return `Search: ${values?.query}`;
      return key;
    },
  }),
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
    searchText: "",
    selectedMuscles: [] as string[],
    selectedEquipment: [] as string[],
    muscleLabels: new Map([["chest", "Chest"]]),
    equipmentLabels: new Map([["barbell", "Barbell"]]),
    onPressFavorites: jest.fn(),
    onPressMuscles: jest.fn(),
    onPressEquipment: jest.fn(),
    onRemoveSearch: jest.fn(),
    onRemoveFavorite: jest.fn(),
    onRemoveMuscle: jest.fn(),
    onRemoveEquipment: jest.fn(),
    onClearAll: jest.fn(),
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

    const favorites = screen
      .getAllByRole("button", { name: "filters.favorites" })
      .find((button) => button.props.accessibilityState?.selected)!;
    expect(favorites).toBeDefined();
    expect(favorites.props.accessibilityState?.selected).toBe(true);
    expect(screen.getByText("heart.fill")).toBeTruthy();
  });

  it("shows removable active filters and clears them together", () => {
    render(
      <FilterPills
        {...defaultProps}
        favoritesOnly
        searchText="bench"
        selectedMuscles={["chest"]}
        selectedEquipment={["barbell"]}
      />
    );

    fireEvent.press(screen.getByRole("button", { name: "Remove Chest" }));
    fireEvent.press(screen.getByRole("button", { name: "Remove Barbell" }));
    fireEvent.press(screen.getByRole("button", { name: "filters.clearAll" }));

    expect(defaultProps.onRemoveMuscle).toHaveBeenCalledWith("chest");
    expect(defaultProps.onRemoveEquipment).toHaveBeenCalledWith("barbell");
    expect(defaultProps.onClearAll).toHaveBeenCalledTimes(1);
  });
});
