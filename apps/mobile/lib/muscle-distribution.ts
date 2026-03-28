import type { DonutSegment } from "@/components/history/donut-chart";

// Derived from the primary (#3898D8 light / #5AAEE0 dark) with progressively
// muted and varied hues so the chart is readable without being garish.
export const MUSCLE_SEGMENT_COLORS = [
  "#3898D8",
  "#34C759",
  "#FFAC30",
  "#AF7BFF",
  "#FF6B6B",
  "#20B2AA",
  "#FF8C42",
  "#A8DADC",
  "#E63946",
  "#6A994E",
] as const;

export interface MuscleDistributionRow {
  primaryMuscles: string[];
  completedSetCount: number;
}

export function aggregateMuscleDistribution(
  rows: MuscleDistributionRow[]
): DonutSegment[] {
  const muscleCounts: Record<string, number> = {};

  for (const row of rows) {
    if (row.completedSetCount === 0) continue;
    for (const muscle of row.primaryMuscles) {
      muscleCounts[muscle] =
        (muscleCounts[muscle] ?? 0) + row.completedSetCount;
    }
  }

  const sorted = Object.entries(muscleCounts).sort(([, a], [, b]) => b - a);

  return sorted.map(([label, value], idx) => ({
    label,
    value,
    color:
      MUSCLE_SEGMENT_COLORS[idx % MUSCLE_SEGMENT_COLORS.length] ?? "#888888",
  }));
}
