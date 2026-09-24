import { getMondayLocal } from "@/lib/iso-week";
import {
  getCalendarDateKey,
  getCalendarWeekStartKey,
} from "@/lib/streak-calendar";

export interface SessionTimeRange {
  started_at: string;
  completed_at: string;
}

export interface WeekMinutes {
  /** Local Monday as a calendar key (`YYYY-MM-DD`). */
  weekStart: string;
  minutes: number;
}

/** Calendar arithmetic keeps local midnights stable across DST changes. */
export function addLocalDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** Local Monday that opens a window of `weeks` weeks ending with the current one. */
export function getWindowStart(now: Date, weeks: number): Date {
  return addLocalDays(getMondayLocal(now), -7 * (weeks - 1));
}

/**
 * Minutes trained per local Monday–Sunday week, oldest first, ending with the
 * current week. Sessions without a valid start/end pair are skipped.
 */
export function buildWeeklyMinutes(
  rows: readonly SessionTimeRange[],
  now: Date,
  weeks: number
): WeekMinutes[] {
  const start = getWindowStart(now, weeks);
  const buckets = Array.from({ length: weeks }, (_, index) => ({
    weekStart: getCalendarDateKey(addLocalDays(start, index * 7)),
    minutes: 0,
  }));
  const bucketIndex = new Map(
    buckets.map((bucket, index) => [bucket.weekStart, index])
  );

  for (const row of rows) {
    const startedAt = Date.parse(row.started_at);
    const completedAt = Date.parse(row.completed_at);
    if (
      !Number.isFinite(startedAt) ||
      !Number.isFinite(completedAt) ||
      completedAt <= startedAt
    ) {
      continue;
    }
    const index = bucketIndex.get(
      getCalendarWeekStartKey(new Date(completedAt))
    );
    if (index === undefined) continue;
    buckets[index].minutes += (completedAt - startedAt) / 60_000;
  }

  return buckets.map((bucket) => ({
    ...bucket,
    minutes: Math.round(bucket.minutes),
  }));
}
