import { getCalendarDateKey } from "@/lib/streak-calendar";
import { addLocalDays, getWindowStart } from "@/lib/weekly-activity";

import type { WidgetActivityDay } from "./types";

export const CONSISTENCY_WEEKS = 12;
export const CONSISTENCY_SHORT_WEEKS = 8;
export const TRAINING_TIME_WEEKS = 8;

function parseDates(isoDates: readonly string[]): Date[] {
  return isoDates
    .map((iso) => new Date(iso))
    .filter((date) => !Number.isNaN(date.getTime()));
}

/** One entry per local day, Monday-first, for `weeks` full weeks ending this week. */
export function buildActivityDays(
  completedAtIsos: readonly string[],
  now: Date,
  weeks = CONSISTENCY_WEEKS
): WidgetActivityDay[] {
  const trainedKeys = new Set(
    parseDates(completedAtIsos).map((date) => getCalendarDateKey(date))
  );
  const start = getWindowStart(now, weeks);

  return Array.from({ length: weeks * 7 }, (_, index) => {
    const date = getCalendarDateKey(addLocalDays(start, index));
    return { date, trained: trainedKeys.has(date) };
  });
}

/** Sessions completed from the start of the `weeks` window up to `now`. */
export function countSessionsInWindow(
  completedAtIsos: readonly string[],
  now: Date,
  weeks: number
): number {
  const start = getWindowStart(now, weeks).getTime();
  const end = now.getTime();
  return parseDates(completedAtIsos).filter((date) => {
    const time = date.getTime();
    return time >= start && time <= end;
  }).length;
}
