import { render, screen } from "@testing-library/react-native";

import { PeriodSelector } from "../period-selector";

jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));

describe("PeriodSelector", () => {
  it("marks the active option as selected for accessibility", () => {
    render(
      <PeriodSelector
        selected="history"
        onChange={() => {}}
        periods={[
          { key: "overview", label: "Overview" },
          { key: "history", label: "History" },
        ]}
      />
    );

    expect(
      screen.getByRole("button", { name: "History" })
    ).toHaveAccessibilityState({
      selected: true,
    });
    expect(
      screen.getByRole("button", { name: "Overview" })
    ).toHaveAccessibilityState({
      selected: false,
    });
  });
});
