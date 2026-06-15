import { render, screen } from "@testing-library/react-native";

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
});
