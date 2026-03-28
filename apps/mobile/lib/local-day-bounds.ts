const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Half-open [start, end) in UTC for the local calendar day of `YYYY-MM-DD`. */
export function localDayBoundsIso(dateKey: string): {
  startIso: string;
  endIso: string;
} | null {
  if (!DATE_KEY.test(dateKey)) return null;
  const [y, m, d] = dateKey.split("-").map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

export function isValidDateKey(dateKey: string): boolean {
  return DATE_KEY.test(dateKey);
}
