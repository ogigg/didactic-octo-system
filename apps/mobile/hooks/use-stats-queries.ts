import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import type { DonutSegment } from "@/components/history/donut-chart";
import {
  fetchStatsHeatmap,
  fetchStatsVolumeOverTime,
  fetchStatsPersonalRecords,
  fetchStatsMuscleDistribution,
  STATS_PERIODS,
} from "@/lib/api/stats";
import type {
  StatsPeriod,
  HeatmapDay,
  VolumeWeek,
  PersonalRecord,
} from "@/lib/api/stats";
import { aggregateMuscleDistribution } from "@/lib/muscle-distribution";
import { statsKeys } from "@/lib/query-keys";
import { getMuscleDisplayName } from "@/lib/workout-summary-utils";

function computeFromDate(period: StatsPeriod): string {
  if (period === "all") {
    return new Date(0).toISOString();
  }
  const days = STATS_PERIODS[period];
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

export function useHeatmapData(): {
  data: HeatmapDay[] | undefined;
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery({
    queryKey: statsKeys.heatmap(),
    queryFn: () => fetchStatsHeatmap(),
    staleTime: 10 * 60 * 1000,
  });

  return { data, isLoading };
}

export function useVolumeOverTime(period: StatsPeriod): {
  data: VolumeWeek[] | undefined;
  isLoading: boolean;
} {
  const fromDate = useMemo(() => computeFromDate(period), [period]);

  const { data, isLoading } = useQuery({
    queryKey: statsKeys.volume(period),
    queryFn: () => fetchStatsVolumeOverTime(fromDate),
  });

  return { data, isLoading };
}

export function usePersonalRecords(): {
  data: PersonalRecord[] | undefined;
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery({
    queryKey: statsKeys.prs(),
    queryFn: () => fetchStatsPersonalRecords(),
    staleTime: 10 * 60 * 1000,
  });

  return { data, isLoading };
}

export function useMuscleDistributionStats(period: StatsPeriod): {
  segments: DonutSegment[] | undefined;
  isLoading: boolean;
} {
  const fromDate = useMemo(() => computeFromDate(period), [period]);

  const { data: segments, isLoading } = useQuery({
    queryKey: statsKeys.muscleDistribution(period),
    queryFn: () => fetchStatsMuscleDistribution(fromDate),
    select: (rows) =>
      aggregateMuscleDistribution(
        rows.map((row) => ({
          primaryMuscles: [getMuscleDisplayName(row.muscle)],
          completedSetCount: row.set_count,
        }))
      ),
    staleTime: 5 * 60 * 1000,
  });

  return { segments, isLoading };
}
