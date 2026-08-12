import { fireEvent, render, screen } from "@testing-library/react-native";
import {
  StyleSheet,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

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

    expect(weekdayWidth).toBe(containerWidth / 7);
    expect(dateWidth).toBe(weekdayWidth);
    expect(weekdayWidth * 7).toBe(containerWidth);
  });

  it("recalculates aligned columns when the container width changes", () => {
    render(<MonthBlock year={2026} month={7} entries={[]} />);
    const month = screen.getByTestId("calendar-month-layout");

    fireEvent(month, "layout", {
      nativeEvent: {
        layout: { width: 362, height: 0, x: 0, y: 0 },
      },
    });
    expect(getRenderedWidth(screen.getByText("Su"))).toBe(362 / 7);
    expect(getRenderedWidth(screen.getByLabelText("1"))).toBe(362 / 7);

    fireEvent(month, "layout", {
      nativeEvent: {
        layout: { width: 804, height: 0, x: 0, y: 0 },
      },
    });
    expect(getRenderedWidth(screen.getByText("Su"))).toBe(804 / 7);
    expect(getRenderedWidth(screen.getByLabelText("1"))).toBe(804 / 7);
  });
});
