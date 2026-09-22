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

it("shows two checked sets as solid load and the third as a dashed forecast", () => {
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
