export function getTargetQueueCount(
  weeklyFrequency: string | null | undefined
): number {
  if (!weeklyFrequency) {
    return 3;
  }

  if (weeklyFrequency === "5_plus") {
    return 5;
  }

  const parsed = Number.parseInt(weeklyFrequency, 10);
  return Number.isNaN(parsed) ? 3 : parsed;
}

export function getMissingQueueCount(
  queueLength: number,
  targetQueueCount: number
): number {
  return Math.max(0, targetQueueCount - queueLength);
}
