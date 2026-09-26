export interface ChartPoint {
  x: number;
  y: number;
}

export interface TooltipPosition {
  left: number;
  top: number;
  placement: "above" | "below";
}

interface TooltipPositionInput {
  anchor: ChartPoint;
  tooltipWidth: number;
  tooltipHeight: number;
  containerWidth: number;
  /** Space kept between the tooltip and the highlighted point. */
  gap: number;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Tangents for monotone cubic interpolation (Fritsch–Carlson). They keep each
 * segment between its two samples, so the smoothed curve never invents a peak
 * or dip that isn't in the data.
 */
function monotoneTangents(points: readonly ChartPoint[]): number[] {
  const count = points.length;
  const slopes: number[] = [];
  for (let i = 0; i < count - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    slopes.push(dx === 0 ? 0 : (points[i + 1].y - points[i].y) / dx);
  }

  const tangents = new Array<number>(count);
  tangents[0] = slopes[0];
  tangents[count - 1] = slopes[count - 2];
  for (let i = 1; i < count - 1; i++) {
    tangents[i] =
      slopes[i - 1] * slopes[i] <= 0 ? 0 : (slopes[i - 1] + slopes[i]) / 2;
  }

  for (let i = 0; i < count - 1; i++) {
    if (slopes[i] === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
      continue;
    }
    const a = tangents[i] / slopes[i];
    const b = tangents[i + 1] / slopes[i];
    const magnitude = a * a + b * b;
    if (magnitude > 9) {
      const scale = 3 / Math.sqrt(magnitude);
      tangents[i] = scale * a * slopes[i];
      tangents[i + 1] = scale * b * slopes[i];
    }
  }

  return tangents;
}

/** SVG path through `points` (sorted by x) as a smooth, non-overshooting curve. */
export function buildSmoothLinePath(points: readonly ChartPoint[]): string {
  if (points.length === 0) return "";
  const [first] = points;
  const start = `M ${round(first.x)} ${round(first.y)}`;
  if (points.length === 1) return start;
  if (points.length === 2) {
    return `${start} L ${round(points[1].x)} ${round(points[1].y)}`;
  }

  const tangents = monotoneTangents(points);
  const segments = [start];
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i];
    const to = points[i + 1];
    const third = (to.x - from.x) / 3;
    segments.push(
      `C ${round(from.x + third)} ${round(from.y + tangents[i] * third)} ` +
        `${round(to.x - third)} ${round(to.y - tangents[i + 1] * third)} ` +
        `${round(to.x)} ${round(to.y)}`
    );
  }
  return segments.join(" ");
}

/** The smooth line closed down to `baselineY`, for a gradient fill under it. */
export function buildSmoothAreaPath(
  points: readonly ChartPoint[],
  baselineY: number
): string {
  if (points.length === 0) return "";
  const first = points[0];
  const last = points[points.length - 1];
  const baseline = round(baselineY);
  return `${buildSmoothLinePath(points)} L ${round(last.x)} ${baseline} L ${round(first.x)} ${baseline} Z`;
}

/** Index of the point closest to `x` horizontally, or -1 when there are none. */
export function findNearestPointIndex(
  points: readonly ChartPoint[],
  x: number
): number {
  let nearest = -1;
  let nearestDistance = Infinity;
  points.forEach((point, index) => {
    const distance = Math.abs(point.x - x);
    if (distance < nearestDistance) {
      nearest = index;
      nearestDistance = distance;
    }
  });
  return nearest;
}

/**
 * Centres the tooltip over the point, keeps it inside the chart, and puts it
 * above the point unless that would push it off the top edge.
 */
export function getTooltipPosition({
  anchor,
  tooltipWidth,
  tooltipHeight,
  containerWidth,
  gap,
}: TooltipPositionInput): TooltipPosition {
  const maxLeft = Math.max(containerWidth - tooltipWidth, 0);
  const left = Math.min(Math.max(anchor.x - tooltipWidth / 2, 0), maxLeft);
  const aboveTop = anchor.y - gap - tooltipHeight;
  return aboveTop >= 0
    ? { left, top: aboveTop, placement: "above" }
    : { left, top: anchor.y + gap, placement: "below" };
}
