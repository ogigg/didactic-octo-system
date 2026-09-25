jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
}));

import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { State } from "react-native-gesture-handler";
import {
  fireGestureHandler,
  getByGestureTestId,
} from "react-native-gesture-handler/jest-utils";
import { Text as SvgText } from "react-native-svg";

import type { HeartRateSample } from "@/lib/health";

import { HeartRateChart } from "../heart-rate-chart";

// Local times, so the clock labels read the same in every time zone.
const startedAt = new Date(2026, 8, 25, 18, 0);
const endedAt = new Date(2026, 8, 25, 18, 20);
const samples: HeartRateSample[] = [
  { timestamp: new Date(2026, 8, 25, 18, 0), bpm: 120 },
  { timestamp: new Date(2026, 8, 25, 18, 10), bpm: 150 },
  { timestamp: new Date(2026, 8, 25, 18, 20), bpm: 130 },
];

// The plot spans the card's inner width; x = 0 and x = 10 000 clamp to the
// first and last sample, and the middle sample sits halfway across.
const X_MIDDLE = 36 + (750 - 20 * 2 - 16 * 2 - 36 - 12) / 2;

function chart(series: HeartRateSample[] = samples) {
  return (
    <HeartRateChart
      samples={series}
      startedAt={startedAt}
      endedAt={endedAt}
      title="Heart rate"
      avgLabel="Avg"
      minLabel="Min"
      maxLabel="Max"
      unitLabel="bpm"
    />
  );
}

function renderChart() {
  return render(chart());
}

function tapAt(x: number) {
  act(() =>
    fireGestureHandler(getByGestureTestId("chart-tap"), [
      { state: State.BEGAN, x, y: 40 },
      { state: State.ACTIVE, x, y: 40 },
      { state: State.END, x, y: 40 },
    ])
  );
}

describe("HeartRateChart", () => {
  it("marks the workout average with a labelled reference line", () => {
    const { UNSAFE_getAllByType } = renderChart();

    expect(screen.getByTestId("hr-average-line")).toBeTruthy();
    expect(
      UNSAFE_getAllByType(SvgText).map((node) => String(node.props.children))
    ).toContain("Avg 133");
  });

  it("pins the tapped sample and unpins it on a second tap", () => {
    renderChart();
    expect(screen.queryByTestId("chart-tooltip")).toBeNull();

    tapAt(X_MIDDLE + 15);
    expect(screen.getByText("150 bpm")).toBeTruthy();
    expect(screen.getByText("18:10")).toBeTruthy();
    expect(screen.getByTestId("chart-crosshair")).toBeTruthy();

    tapAt(X_MIDDLE - 15);
    expect(screen.queryByTestId("chart-tooltip")).toBeNull();
  });

  it("keeps the pin on the same reading when late samples arrive", () => {
    const { rerender } = renderChart();
    tapAt(X_MIDDLE);
    expect(screen.getByText("150 bpm")).toBeTruthy();

    // An earlier sample shifts every index after it.
    rerender(
      chart([
        samples[0],
        { timestamp: new Date(2026, 8, 25, 18, 5), bpm: 135 },
        samples[1],
        samples[2],
      ])
    );

    expect(screen.getByText("150 bpm")).toBeTruthy();
    expect(screen.getByText("18:10")).toBeTruthy();
    expect(screen.queryByText("135 bpm")).toBeNull();
  });

  it("keeps the sample a drag ends on", () => {
    renderChart();

    act(() =>
      fireGestureHandler(getByGestureTestId("chart-scrub"), [
        { state: State.BEGAN, x: 0, y: 40 },
        { state: State.ACTIVE, x: 10, y: 40 },
        { state: State.ACTIVE, x: X_MIDDLE, y: 40 },
        { state: State.ACTIVE, x: 10000, y: 40 },
        { state: State.END, x: 10000, y: 40 },
      ])
    );

    expect(screen.getByText("130 bpm")).toBeTruthy();
    expect(screen.getByText("18:20")).toBeTruthy();
  });

  it("lets screen readers step through the samples", () => {
    renderChart();
    const chart = screen.getByRole("adjustable", { name: "Heart rate" });
    expect(chart.props.accessibilityValue).toEqual({ text: "Avg 133 bpm" });

    fireEvent(chart, "accessibilityAction", {
      nativeEvent: { actionName: "decrement" },
    });

    expect(
      screen.getByRole("adjustable", { name: "Heart rate" }).props
        .accessibilityValue
    ).toEqual({ text: "150 bpm, 18:10" });
  });
});
