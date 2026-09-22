import { fireEvent, render, screen } from "@testing-library/react-native";

import { VolumeBarChart } from "../volume-bar-chart";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        "volume.total": "Total",
        "volume.weeklyAvg": "Weekly avg",
        "volume.perWeek": "/wk",
      })[key] ?? key,
  }),
}));

jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));

jest.mock("@/hooks/use-weight-unit", () => ({
  useWeightUnit: () => ({
    formatVolume: (value: number) => `${value}kg`,
  }),
}));

jest.mock("@/components/ui/icon-symbol", () => ({ IconSymbol: () => null }));

describe("VolumeBarChart", () => {
  it("renders duration totals when configured for time exercises", () => {
    render(
      <VolumeBarChart
        metric="duration"
        labels={{
          total: "Total time",
          average: "Weekly avg",
          perWeek: "/wk",
        }}
        data={[
          {
            week_start: "2026-06-01",
            volume_kg: 0,
            total_duration_seconds: 90,
          },
          {
            week_start: "2026-06-08",
            volume_kg: 0,
            total_duration_seconds: 30,
          },
        ]}
      />
    );

    expect(screen.getByText(/Total time/)).toBeTruthy();
    expect(screen.getByText("2:00")).toBeTruthy();
    expect(screen.getByText("1:00")).toBeTruthy();
  });

  it("keeps weight volume as the default metric", () => {
    render(
      <VolumeBarChart data={[{ week_start: "2026-06-01", volume_kg: 120 }]} />
    );

    expect(screen.getByText(/Total/)).toBeTruthy();
    expect(screen.getAllByText("120kg")).toHaveLength(2);
  });

  it("shows details on hover and closes them with the X button", () => {
    render(
      <VolumeBarChart
        data={[{ week_start: "2026-06-01", volume_kg: 120 }]}
        getTooltip={() => ({
          title: "Week of Jun 1, 2026",
          accessibilityLabel: "Week of Jun 1, Volume: 120kg",
          metrics: [
            { label: "Volume", value: "120kg" },
            { label: "Max reps", value: "8" },
          ],
        })}
      />
    );

    const bar = screen.getByLabelText("Week of Jun 1, Volume: 120kg");

    fireEvent(bar, "hoverIn");
    expect(screen.getByText("Week of Jun 1, 2026")).toBeTruthy();

    fireEvent.press(screen.getByLabelText("volume.closeTooltip"));
    expect(screen.queryByText("Week of Jun 1, 2026")).toBeNull();

    fireEvent.press(bar);
    expect(screen.getByText("Week of Jun 1, 2026")).toBeTruthy();
    expect(screen.getByText("Max reps")).toBeTruthy();

    fireEvent.press(screen.getByLabelText("volume.closeTooltip"));
    expect(screen.queryByText("Week of Jun 1, 2026")).toBeNull();
  });
});

it("shows two checked sets as hatched load and the third as a dashed forecast", () => {
  const { rerender } = render(
    <VolumeBarChart
      data={[]}
      today={{ completed: 200, forecast: 300, completedSets: 2, totalSets: 3 }}
    />
  );
  expect(screen.getByTestId("today-completed")).toHaveStyle({ height: 80 });
  expect(screen.getByTestId("today-forecast")).toHaveStyle({
    height: 40,
    borderStyle: "dashed",
  });
  fireEvent.press(
    screen.getByLabelText(/volume.today, volume.completed: 200kg/)
  );
  expect(screen.getByText("2/3")).toBeTruthy();
  expect(screen.getByText("300kg")).toBeTruthy();
  fireEvent.press(screen.getByLabelText("volume.closeTooltip"));
  rerender(
    <VolumeBarChart
      data={[]}
      today={{ completed: 300, forecast: 300, completedSets: 3, totalSets: 3 }}
    />
  );
  expect(screen.queryByTestId("today-forecast")).toBeNull();
  expect(screen.getByTestId("today-completed")).toHaveStyle({ height: 120 });
});

it("highlights both Today sections on hover and dims them when a historical bar is selected", () => {
  render(
    <VolumeBarChart
      data={[{ week_start: "2026-06-01", volume_kg: 300 }]}
      today={{ completed: 200, forecast: 300, completedSets: 2, totalSets: 3 }}
      getTooltip={() => ({
        title: "Historical week",
        accessibilityLabel: "Historical week",
        metrics: [],
      })}
    />
  );
  const today = screen.getByLabelText(/volume.today, volume.completed: 200kg/);
  const history = screen.getByLabelText("Historical week");
  fireEvent(today, "hoverIn");
  expect(screen.getByTestId("today-completed")).toHaveStyle({ opacity: 1 });
  expect(screen.getByTestId("today-forecast")).toHaveStyle({ opacity: 1 });
  fireEvent.press(screen.getByLabelText("volume.closeTooltip"));
  expect(screen.getByTestId("today-completed")).toHaveStyle({ opacity: 0.6 });
  expect(screen.getByTestId("today-forecast")).toHaveStyle({ opacity: 0.45 });
  fireEvent.press(history);
  expect(screen.getByTestId("today-completed")).toHaveStyle({ opacity: 0.35 });
  expect(screen.getByTestId("today-forecast")).toHaveStyle({ opacity: 0.35 });
});

it("keeps long histories readable while leaving the preview fitted to its viewport", () => {
  const data = Array.from({ length: 52 }, (_, index) => ({
    week_start: new Date(Date.UTC(2026, 0, 5 + index * 7))
      .toISOString()
      .slice(0, 10),
    volume_kg: 100,
  }));
  const { rerender } = render(
    <VolumeBarChart
      data={data}
      scrollable
      getTooltip={(week) => ({
        title: "Selected week",
        accessibilityLabel: week.week_start,
        metrics: [],
      })}
    />
  );
  fireEvent(screen.getByTestId("chart-viewport"), "layout", {
    nativeEvent: { layout: { width: 360, height: 140, x: 0, y: 0 } },
  });
  expect(screen.getByTestId("chart-content")).toHaveStyle({ width: 1870 });
  expect(screen.getByTestId("chart-scroll").props.scrollEnabled).toBe(true);
  const bar = screen.getByLabelText(data[0].week_start);
  fireEvent(bar, "hoverIn");
  expect(screen.queryByText("Selected week")).toBeNull();
  fireEvent.press(bar);
  expect(screen.getByText("Selected week")).toBeTruthy();
  fireEvent.press(screen.getByLabelText("volume.closeTooltip"));
  rerender(<VolumeBarChart data={data.slice(-10)} />);
  expect(screen.getByTestId("chart-content")).toHaveStyle({ width: 360 });
  expect(screen.getByTestId("chart-scroll").props.scrollEnabled).toBe(false);
});
