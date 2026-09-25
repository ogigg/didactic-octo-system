let mockLanguage = "en";

jest.mock("@/hooks/use-exercises-query", () => ({
  useAppCatalogLanguage: () => mockLanguage,
}));

jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));

import { render, screen } from "@testing-library/react-native";
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
