/**
 * Formats a duration in seconds for display in exercise set rows.
 * Examples: 45 → "0:45", 90 → "1:30", 3661 → "1:01:01"
 */
export function formatExerciseDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Parses a duration display string back to seconds.
 * Accepts "0:45", "1:30", "1:01:01" formats.
 * Returns null if the string cannot be parsed.
 */
export function parseExerciseDuration(display: string): number | null {
  const parts = display.split(":").map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 2) {
    const [m, s] = parts;
    if (s < 0 || s > 59) return null;
    return m * 60 + s;
  }
  if (parts.length === 3) {
    const [h, m, s] = parts;
    if (m < 0 || m > 59 || s < 0 || s > 59) return null;
    return h * 3600 + m * 60 + s;
  }
  return null;
}
