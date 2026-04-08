import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { useAuth } from "@/hooks/use-auth";
import {
  fetchLatestMeasurements,
  fetchMeasurementTrend,
  upsertMeasurement,
  STATS_PERIODS,
} from "@/lib/api/body-measurements";
import type {
  StatsPeriod,
  MeasurementTrendPoint,
  LatestMeasurements,
  MeasurementInput,
} from "@/lib/api/body-measurements";
import type { MeasurementField } from "@/data/measurements";
import { measurementKeys } from "@/lib/query-keys";
import { syncQueue } from "@/lib/sync-queue";

function computeFromDate(period: StatsPeriod): string | null {
  if (period === "all") {
    return null;
  }
  const days = STATS_PERIODS[period];
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

export type { StatsPeriod };

export function useMeasurementTrend(
  field: MeasurementField,
  period: StatsPeriod
): {
  data: MeasurementTrendPoint[] | undefined;
  isLoading: boolean;
} {
  const fromDate = useMemo(() => computeFromDate(period), [period]);

  const { data, isLoading } = useQuery({
    queryKey: measurementKeys.trend(field, fromDate),
    queryFn: () => fetchMeasurementTrend(field, fromDate),
    staleTime: 5 * 60 * 1000,
  });

  return { data, isLoading };
}

export function useLatestMeasurements(): {
  data: LatestMeasurements | undefined;
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery({
    queryKey: measurementKeys.latest(),
    queryFn: () => fetchLatestMeasurements(),
    staleTime: 10 * 60 * 1000,
  });

  return { data, isLoading };
}

export function useUpsertMeasurement() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (input: { loggedAt: string; fields: MeasurementInput }) =>
      upsertMeasurement(input.loggedAt, input.fields),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: measurementKeys.all });
    },
    onError: (_error: unknown, variables) => {
      if (user) {
        syncQueue
          .enqueue("upsert_measurement", user.id, variables)
          .catch(console.warn);
      }
    },
  });
}
