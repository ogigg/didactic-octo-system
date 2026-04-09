import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { useAuth } from "@/hooks/use-auth";
import {
  fetchLatestMeasurements,
  fetchMeasurementTrend,
  fetchMeasurementHistory,
  upsertMeasurement,
  deleteMeasurement,
  STATS_PERIODS,
} from "@/lib/api/body-measurements";
import type {
  StatsPeriod,
  MeasurementTrendPoint,
  LatestMeasurements,
  MeasurementHistoryItem,
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
  refetch: () => Promise<unknown>;
} {
  const fromDate = useMemo(() => computeFromDate(period), [period]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: measurementKeys.trend(field, fromDate),
    queryFn: () => fetchMeasurementTrend(field, fromDate),
    staleTime: 5 * 60 * 1000,
  });

  return { data, isLoading, refetch };
}

export function useLatestMeasurements(): {
  data: LatestMeasurements | undefined;
  isLoading: boolean;
  refetch: () => Promise<unknown>;
} {
  const { data, isLoading, refetch } = useQuery({
    queryKey: measurementKeys.latest(),
    queryFn: () => fetchLatestMeasurements(),
    staleTime: 10 * 60 * 1000,
  });

  return { data, isLoading, refetch };
}

export function useUpsertMeasurement() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (input: {
      loggedAt: string;
      originalLoggedAt?: string;
      fields: MeasurementInput;
    }) =>
      upsertMeasurement(input.loggedAt, input.fields, input.originalLoggedAt),
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

export function useMeasurementHistory(field: MeasurementField): {
  data: MeasurementHistoryItem[] | undefined;
  isLoading: boolean;
  refetch: () => Promise<unknown>;
} {
  const { data, isLoading, refetch } = useQuery({
    queryKey: measurementKeys.history(field),
    queryFn: () => fetchMeasurementHistory(field),
    staleTime: 5 * 60 * 1000,
  });

  return { data, isLoading, refetch };
}

export function useDeleteMeasurement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (loggedAt: string) => deleteMeasurement(loggedAt),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: measurementKeys.all });
    },
  });
}
