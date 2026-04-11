import { useQuery } from "@tanstack/react-query";

import { readHeartRateSamples } from "@/lib/health";
import type { HeartRateSample } from "@/lib/health";

/**
 * Read heart rate samples recorded in the platform health store between the
 * given start and end times. Cache-only — nothing is persisted in Supabase.
 *
 * The query is keyed by the ISO timestamps, so opening the same session
 * again reuses the cached result. Disabled when `startedAt` or `endedAt` is
 * null (e.g. workout-detail data still loading).
 */
export function useHeartRateSamples(
  startedAt: Date | null,
  endedAt: Date | null
) {
  const startIso = startedAt?.toISOString() ?? null;
  const endIso = endedAt?.toISOString() ?? null;

  return useQuery<HeartRateSample[]>({
    queryKey: ["heart-rate-samples", startIso, endIso],
    enabled: !!startedAt && !!endedAt,
    // HR samples for a completed window are immutable — cache forever.
    staleTime: Infinity,
    gcTime: 1000 * 60 * 30,
    queryFn: async () => {
      if (!startedAt || !endedAt) return [];
      return readHeartRateSamples(startedAt, endedAt);
    },
  });
}
