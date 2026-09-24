let mockWorkoutStats: {
  totalWorkouts: number | null;
  streakWeeks: number | null;
  isTotalLoading: boolean;
  isStreakLoading: boolean;
};

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      options?.count != null ? `${key}:${options.count}` : key,
  }),
}));

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");

  return {
    SafeAreaView: ({
      children,
      style,
    }: {
      children?: React.ReactNode;
      style?: unknown;
    }) => React.createElement(View, { style }, children),
  };
});

jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#3366FF"),
}));

jest.mock("@/hooks/use-stats-queries", () => ({
  useHeatmapData: () => ({ data: [], isLoading: false }),
  useMuscleDistributionStats: () => ({ segments: [], isLoading: false }),
  useVolumeOverTime: () => ({ data: [], isLoading: false }),
  usePersonalRecords: () => ({ data: [], isLoading: false }),
}));

jest.mock("@/hooks/use-workout-stats", () => ({
  useWorkoutStats: () => mockWorkoutStats,
}));

jest.mock("@/components/ambient-glow", () => ({ AmbientGlow: () => null }));
jest.mock("@/components/history/donut-chart", () => ({
  DonutChart: () => null,
}));
jest.mock("@/components/history/muscle-legend", () => ({
  MuscleLegend: () => null,
}));
jest.mock("@/components/stats/heatmap-chart", () => ({
  HeatmapChart: () => null,
}));
jest.mock("@/components/stats/pr-list", () => ({ PRList: () => null }));
jest.mock("@/components/stats/volume-bar-chart", () => ({
  VolumeBarChart: () => null,
}));
jest.mock("@/components/ui/screen-header", () => ({
  ScreenHeader: () => null,
}));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react-native";
import { RefreshControl } from "react-native";

import {
  statsKeys,
  streakProtectionKeys,
  workoutStatsKeys,
} from "@/lib/query-keys";

import StatisticsScreen from "../statistics";

function renderScreen() {
  const queryClient = new QueryClient();
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <StatisticsScreen />
    </QueryClientProvider>
  );
  return { ...utils, queryClient };
}

describe("StatisticsScreen", () => {
  beforeEach(() => {
    mockWorkoutStats = {
      totalWorkouts: 8,
      streakWeeks: 2,
      isTotalLoading: false,
      isStreakLoading: false,
    };
  });

  it("refetches every active section on pull and shows the indicator until they settle", async () => {
    let resolveRefetch!: () => void;
    const pending = new Promise<void>((resolve) => {
      resolveRefetch = resolve;
    });

    const { UNSAFE_getByType, queryClient } = renderScreen();
    const refetchQueries = jest
      .spyOn(queryClient, "refetchQueries")
      .mockReturnValue(pending);
    expect(UNSAFE_getByType(RefreshControl).props.refreshing).toBe(false);

    let refreshPromise!: Promise<void>;
    act(() => {
      refreshPromise = UNSAFE_getByType(RefreshControl).props.onRefresh();
    });

    expect(refetchQueries).toHaveBeenCalledWith({
      queryKey: statsKeys.all,
      type: "active",
    });
    expect(refetchQueries).toHaveBeenCalledWith({
      queryKey: workoutStatsKeys.all,
      exact: true,
      type: "active",
    });
    expect(refetchQueries).toHaveBeenCalledWith({
      queryKey: streakProtectionKeys.all,
      type: "active",
    });
    expect(UNSAFE_getByType(RefreshControl).props.refreshing).toBe(true);

    await act(async () => {
      resolveRefetch();
      await refreshPromise;
    });

    expect(UNSAFE_getByType(RefreshControl).props.refreshing).toBe(false);
  });

  it("shows the workout count while the streak is still loading", () => {
    mockWorkoutStats = {
      totalWorkouts: 8,
      streakWeeks: null,
      isTotalLoading: false,
      isStreakLoading: true,
    };

    renderScreen();

    expect(screen.getByText("heatmap.workoutsThisYear:8")).toBeTruthy();
    expect(screen.getByText("—")).toBeTruthy();
  });
});
