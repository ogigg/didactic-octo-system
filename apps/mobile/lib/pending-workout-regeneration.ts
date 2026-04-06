export interface PendingWorkoutRegenerationEligibility {
  canRegenerate: boolean;
  wasRegeneratedToday: boolean;
  timezoneOffsetMinutes: number;
}

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getCurrentTimezoneOffsetMinutes(
  now: Date = new Date()
): number {
  return now.getTimezoneOffset();
}

export function wasPendingWorkoutRegeneratedToday(
  lastRegeneratedAt: string | null,
  now: Date = new Date()
): boolean {
  if (!lastRegeneratedAt) {
    return false;
  }

  return toLocalDateKey(new Date(lastRegeneratedAt)) === toLocalDateKey(now);
}

export function getPendingWorkoutRegenerationEligibility(
  lastRegeneratedAt: string | null,
  now: Date = new Date()
): PendingWorkoutRegenerationEligibility {
  const wasRegeneratedToday = wasPendingWorkoutRegeneratedToday(
    lastRegeneratedAt,
    now
  );

  return {
    canRegenerate: !wasRegeneratedToday,
    wasRegeneratedToday,
    timezoneOffsetMinutes: getCurrentTimezoneOffsetMinutes(now),
  };
}
