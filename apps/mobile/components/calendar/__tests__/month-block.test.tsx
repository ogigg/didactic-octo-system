import { fireEvent, render, screen } from "@testing-library/react-native";
import {
  StyleSheet,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import "@/i18n";
import { MonthBlock } from "../month-block";

jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));

interface StyledElement {
  props: {
    style?: StyleProp<TextStyle | ViewStyle>;
  };
}

function getRenderedWidth(element: StyledElement): number {
  const style = StyleSheet.flatten(element.props.style);
  if (typeof style.width !== "number") {
    throw new Error("Expected calendar column to have a numeric width");
  }
  return style.width;
}

describe("MonthBlock responsive columns", () => {
  it.each([
    ["small iPhone", 280],
    ["standard iPhone", 350],
    ["Pro-size iPhone", 362],
  ])("fits seven aligned columns on a %s container", (_, containerWidth) => {
    render(<MonthBlock year={2026} month={7} entries={[]} />);

    fireEvent(screen.getByTestId("calendar-month-layout"), "layout", {
      nativeEvent: {
        layout: { width: containerWidth, height: 0, x: 0, y: 0 },
      },
    });

    const weekdayWidth = getRenderedWidth(screen.getByText("Su"));
    const dateWidth = getRenderedWidth(screen.getByLabelText("1"));

    expect(weekdayWidth).toBe(Math.floor(containerWidth / 7));
    expect(dateWidth).toBe(weekdayWidth);
    expect(weekdayWidth * 7).toBeLessThanOrEqual(containerWidth);
  });

  it("recalculates aligned columns when the container width changes", () => {
    render(<MonthBlock year={2026} month={7} entries={[]} />);
    const month = screen.getByTestId("calendar-month-layout");

    fireEvent(month, "layout", {
      nativeEvent: {
        layout: { width: 362, height: 0, x: 0, y: 0 },
      },
    });
    expect(getRenderedWidth(screen.getByText("Su"))).toBe(Math.floor(362 / 7));
    expect(getRenderedWidth(screen.getByLabelText("1"))).toBe(
      Math.floor(362 / 7)
    );

    fireEvent(month, "layout", {
      nativeEvent: {
        layout: { width: 804, height: 0, x: 0, y: 0 },
      },
    });
    expect(getRenderedWidth(screen.getByText("Su"))).toBe(Math.floor(804 / 7));
    expect(getRenderedWidth(screen.getByLabelText("1"))).toBe(
      Math.floor(804 / 7)
    );
  });

  it("marks a covered week on every day in that week", () => {
    render(
      <MonthBlock
        year={2026}
        month={7}
        entries={[]}
        getWeekStatusForDate={(dateKey) =>
          dateKey <= "2026-07-05" ? "covered" : undefined
        }
      />
    );

    expect(
      screen.getAllByTestId("calendar-week-highlight-covered-2026-06-29")
    ).toHaveLength(5);
    expect(screen.getByLabelText("1, Protected week")).toBeVisible();
    expect(screen.getByLabelText("5, Protected week")).toBeVisible();
    expect(screen.getByLabelText("6")).toBeVisible();
  });
});
