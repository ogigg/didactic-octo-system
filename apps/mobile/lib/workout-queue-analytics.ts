/**
 * Keep row-ready analytics idempotent across query/effect rerenders. A request
 * can produce several rows, so both identifiers are part of the key.
 */
export function markPendingWorkoutGeneratedTracked(
  trackedKeys: Set<string>,
  requestId: string | null,
  workoutId: string
): boolean {
  const key = `${requestId ?? "unknown"}:${workoutId}`;
  if (trackedKeys.has(key)) return false;

  trackedKeys.add(key);
  return true;
}
