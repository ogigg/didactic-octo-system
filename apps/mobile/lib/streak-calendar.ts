// Temporary calendar preview; never enabled in release builds.
export const MOCK_NEXT_WEEK_AS_RUINED =
  typeof __DEV__ !== "undefined" && __DEV__;

// Fixed visual preview requested for September 2026; no persisted data changes.
export const MOCK_FAILED_WEEK_WITH_FREEZE = MOCK_NEXT_WEEK_AS_RUINED
  ? { weekStart: "2026-09-21", freezeDate: "2026-09-24" }
  : null;

export const STREAK_WEEK_STATUSES = {
  active: "active",
  covered: "covered",
  ruined: "ruined",
} as const;

export type StreakWeekStatus =
  (typeof STREAK_WEEK_STATUSES)[keyof typeof STREAK_WEEK_STATUSES];

export interface StreakCalendarData {
  qualifyingCompletedAtDates: string[];
  protectedWeekStarts: string[];
}

const DAYS_IN_WEEK = 7;

/** Calendar bands use the same local dates as the displayed workout entries.
 * Persisted covered_week_start values are already Monday date labels.
 */
export function getCalendarDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function getCalendarWeekStartKey(date: Date): string {
  const cursor = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  cursor.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));
  return getCalendarDateKey(cursor);
}

export function getCalendarWeekStartKeyForDateKey(dateKey: string): string {
  return getCalendarWeekStartKey(new Date(`${dateKey}T00:00:00`));
}

function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return getCalendarDateKey(date);
}

/**
 * Marks the first fully elapsed empty week after each active run. A week is
 * active when it has a qualifying workout or a protection event. This keeps a
 * long absence from painting every subsequent week as another break.
 */
export function getStreakWeekStatuses(
  data: StreakCalendarData,
  now: Date = new Date(),
  mockNextWeekAsRuined = false
): Map<string, StreakWeekStatus> {
  const protectedWeeks = new Set(data.protectedWeekStarts);
  const activeWeeks = new Set(protectedWeeks);

  for (const completedAt of data.qualifyingCompletedAtDates) {
    const date = new Date(completedAt);
    if (!Number.isNaN(date.getTime())) {
      activeWeeks.add(getCalendarWeekStartKey(date));
    }
  }

  const statuses = new Map<string, StreakWeekStatus>();
  for (const weekStart of activeWeeks) {
    statuses.set(
      weekStart,
      protectedWeeks.has(weekStart)
        ? STREAK_WEEK_STATUSES.covered
        : STREAK_WEEK_STATUSES.active
    );
  }

  const currentWeekStart = getCalendarWeekStartKey(now);
  for (const weekStart of activeWeeks) {
    const nextWeek = addDays(weekStart, DAYS_IN_WEEK);
    if (nextWeek < currentWeekStart && !activeWeeks.has(nextWeek)) {
      statuses.set(nextWeek, STREAK_WEEK_STATUSES.ruined);
    }
  }

  if (mockNextWeekAsRuined) {
    statuses.set(
      addDays(currentWeekStart, DAYS_IN_WEEK),
      STREAK_WEEK_STATUSES.ruined
    );
  }

  return statuses;
}
