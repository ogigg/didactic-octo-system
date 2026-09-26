let mockLanguage = "en";

jest.mock("@/hooks/use-exercises-query", () => ({
  useAppCatalogLanguage: () => mockLanguage,
}));

jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
}));

import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { State } from "react-native-gesture-handler";
import {
  fireGestureHandler,
  getByGestureTestId,
} from "react-native-gesture-handler/jest-utils";
import { Text as SvgText } from "react-native-svg";

import type { MeasurementTrendPoint } from "@/lib/api/body-measurements";

import { MeasurementLineChart } from "../line-chart";

const data = [
  { date: "2026-09-05", value: 80 },
  { date: "2026-09-12", value: 79.5 },
];

function renderChart(points: MeasurementTrendPoint[] = data) {
  const utils = render(
    <MeasurementLineChart data={points} unit="kg" selectedPoint={points[0]} />
  );
  const axisLabels = utils
    .UNSAFE_getAllByType(SvgText)
    .map((node) => String(node.props.children));
  return { axisLabels };
}

describe("MeasurementLineChart dates", () => {
  afterEach(() => {
    mockLanguage = "en";
    jest.mocked(console.error).mockClear();
  });

  it("keeps the English date format", () => {
    const { axisLabels } = renderChart();

    expect(axisLabels).toEqual(expect.arrayContaining(["9/5", "9/12"]));
    expect(screen.getByText("Sep 5, 2026")).toBeTruthy();
  });

  it("formats dates in the Polish app language", () => {
    mockLanguage = "pl";

    const { axisLabels } = renderChart();

    expect(axisLabels).toEqual(expect.arrayContaining(["5.09", "12.09"]));
    expect(screen.getByText("5 wrz 2026")).toBeTruthy();
  });

  it("shows the raw value instead of crashing on an invalid date", () => {
    expect(() =>
      renderChart([
        { date: "not-a-date", value: 80 },
        { date: "2026-09-12", value: 79.5 },
      ])
    ).not.toThrow();
    expect(screen.getByText("not-a-date")).toBeTruthy();
  });

  it("keeps axis label keys unique for the same day in different years", () => {
    renderChart([
      { date: "2025-09-05", value: 81 },
      { date: "2026-09-05", value: 80 },
    ]);

    expect(
      jest
        .mocked(console.error)
        .mock.calls.some((call) => String(call[0]).includes("same key"))
    ).toBe(false);
  });
});

// The jest window is 750pt wide, so the plot spans x = 44…698.
const series: MeasurementTrendPoint[] = [
  { date: "2026-09-05", value: 80 },
  { date: "2026-09-12", value: 79.5 },
  { date: "2026-09-19", value: 79.9 },
];
const X_FIRST = 44;
const X_MIDDLE = 371;
const X_LAST = 698;

describe("MeasurementLineChart interaction", () => {
  it("shows no readout until a point is picked", () => {
    render(<MeasurementLineChart data={series} unit="kg" />);

    expect(screen.queryByTestId("chart-tooltip")).toBeNull();
    expect(screen.queryByTestId("chart-crosshair")).toBeNull();
  });

  it("selects the point nearest to a tap", () => {
    const onPointPress = jest.fn();
    render(
      <MeasurementLineChart
        data={series}
        unit="kg"
        onPointPress={onPointPress}
      />
    );

    act(() =>
      fireGestureHandler(getByGestureTestId("chart-tap"), [
        { state: State.BEGAN, x: X_MIDDLE + 20, y: 60 },
        { state: State.ACTIVE, x: X_MIDDLE + 20, y: 60 },
        { state: State.END, x: X_MIDDLE + 20, y: 60 },
      ])
    );

    expect(onPointPress).toHaveBeenCalledWith(series[1]);
  });

  it("follows the finger while scrubbing and keeps the last point", () => {
    const committed: MeasurementTrendPoint[] = [];
    function MeasurementScreen() {
      const [selected, setSelected] = useState<MeasurementTrendPoint | null>(
        null
      );
      return (
        <MeasurementLineChart
          data={series}
          unit="kg"
          selectedPoint={selected}
          onPointPress={(point) => {
            committed.push(point);
            setSelected(point);
          }}
        />
      );
    }
    render(<MeasurementScreen />);
    jest.mocked(Haptics.selectionAsync).mockClear();

    // Jest can't pause mid-gesture, so one drag crosses every point.
    act(() =>
      fireGestureHandler(getByGestureTestId("chart-scrub"), [
        { state: State.BEGAN, x: X_FIRST, y: 60 },
        { state: State.ACTIVE, x: X_FIRST + 10, y: 60 },
        { state: State.ACTIVE, x: X_FIRST + 30, y: 60 },
        { state: State.ACTIVE, x: X_MIDDLE, y: 60 },
        { state: State.ACTIVE, x: X_LAST - 30, y: 60 },
        { state: State.END, x: X_LAST - 30, y: 60 },
      ])
    );

    // One tick per point reached, not per move event.
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(3);
    expect(committed).toEqual([series[2]]);
    expect(screen.getByText("79.9 kg")).toBeTruthy();
    expect(screen.getByTestId("chart-crosshair")).toBeTruthy();
  });

  it("doesn't treat a scroll flick that starts on the chart as a tap", () => {
    render(<MeasurementLineChart data={series} unit="kg" />);

    expect(getByGestureTestId("chart-tap").config.maxDist).toBe(10);
  });

  it("calls the latest handler after the parent re-renders", () => {
    const first = jest.fn();
    const latest = jest.fn();
    const { rerender } = render(
      <MeasurementLineChart data={series} unit="kg" onPointPress={first} />
    );

    rerender(
      <MeasurementLineChart data={series} unit="kg" onPointPress={latest} />
    );

    act(() =>
      fireGestureHandler(getByGestureTestId("chart-tap"), [
        { state: State.BEGAN, x: X_FIRST, y: 60 },
        { state: State.ACTIVE, x: X_FIRST, y: 60 },
        { state: State.END, x: X_FIRST, y: 60 },
      ])
    );
    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledWith(series[0]);
  });

  it("shows the change since the previous entry", () => {
    const { rerender } = render(
      <MeasurementLineChart data={series} unit="kg" selectedPoint={series[1]} />
    );
    expect(screen.getByText("\u22120.5 kg")).toBeTruthy();

    rerender(
      <MeasurementLineChart data={series} unit="kg" selectedPoint={series[2]} />
    );
    expect(screen.getByText("+0.4 kg")).toBeTruthy();

    rerender(
      <MeasurementLineChart data={series} unit="kg" selectedPoint={series[0]} />
    );
    expect(screen.queryByText(/[+\u2212\u00B1]\d/)).toBeNull();
  });

  it("isn't announced as adjustable when points can't be selected", () => {
    render(
      <MeasurementLineChart
        data={series}
        unit="kg"
        accessibilityLabel="Weight"
      />
    );

    expect(screen.queryByRole("adjustable")).toBeNull();
  });

  it("lets screen readers step through the points", () => {
    const onPointPress = jest.fn();
    render(
      <MeasurementLineChart
        data={series}
        unit="kg"
        selectedPoint={series[1]}
        onPointPress={onPointPress}
        accessibilityLabel="Weight"
      />
    );
    const chart = screen.getByRole("adjustable", { name: "Weight" });

    expect(chart.props.accessibilityValue).toEqual({
      text: "79.5 kg, Sep 12, 2026",
    });

    fireEvent(chart, "accessibilityAction", {
      nativeEvent: { actionName: "decrement" },
    });
    fireEvent(chart, "accessibilityAction", {
      nativeEvent: { actionName: "increment" },
    });

    expect(onPointPress.mock.calls).toEqual([[series[0]], [series[2]]]);
  });
});
