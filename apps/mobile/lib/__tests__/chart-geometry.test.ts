import {
  buildSmoothAreaPath,
  buildSmoothLinePath,
  findNearestPointIndex,
  getTooltipPosition,
  type ChartPoint,
} from "../chart-geometry";

/** Every control point of every cubic segment, paired with its segment ends. */
function cubicSegments(path: string) {
  const numbers = (chunk: string) => chunk.trim().split(/\s+/).map(Number);
  const [move, ...curves] = path.split("C");
  const [startX, startY] = numbers(move.replace("M", ""));
  let from = { x: startX, y: startY };
  return curves.map((curve) => {
    const [c1x, c1y, c2x, c2y, x, y] = numbers(curve);
    const segment = { from, c1: { x: c1x, y: c1y }, c2: { x: c2x, y: c2y } };
    from = { x, y };
    return { ...segment, to: from };
  });
}

describe("buildSmoothLinePath", () => {
  it("handles empty, single and two-point series", () => {
    expect(buildSmoothLinePath([])).toBe("");
    expect(buildSmoothLinePath([{ x: 1, y: 2 }])).toBe("M 1 2");
    expect(
      buildSmoothLinePath([
        { x: 0, y: 10 },
        { x: 50, y: 20 },
      ])
    ).toBe("M 0 10 L 50 20");
  });

  it("draws one cubic segment per gap and ends on the last point", () => {
    const path = buildSmoothLinePath([
      { x: 0, y: 40 },
      { x: 30, y: 10 },
      { x: 60, y: 25 },
      { x: 90, y: 5 },
    ]);

    expect(path.startsWith("M 0 40 C")).toBe(true);
    expect(path.match(/C/g)).toHaveLength(3);
    expect(path.endsWith("90 5")).toBe(true);
  });

  it("never overshoots the samples on either side of a segment", () => {
    const points: ChartPoint[] = [
      { x: 0, y: 80 },
      { x: 20, y: 10 },
      { x: 40, y: 10 },
      { x: 60, y: 70 },
      { x: 80, y: 72 },
      { x: 100, y: 0 },
    ];

    for (const { from, to, c1, c2 } of cubicSegments(
      buildSmoothLinePath(points)
    )) {
      const low = Math.min(from.y, to.y);
      const high = Math.max(from.y, to.y);
      for (const control of [c1, c2]) {
        expect(control.y).toBeGreaterThanOrEqual(low);
        expect(control.y).toBeLessThanOrEqual(high);
      }
    }
  });

  it("keeps a flat stretch flat", () => {
    const [, flat] = cubicSegments(
      buildSmoothLinePath([
        { x: 0, y: 50 },
        { x: 10, y: 20 },
        { x: 20, y: 20 },
        { x: 30, y: 60 },
      ])
    );

    expect([flat.c1.y, flat.c2.y]).toEqual([20, 20]);
  });
});

describe("buildSmoothAreaPath", () => {
  it("closes the curve down to the baseline", () => {
    expect(
      buildSmoothAreaPath(
        [
          { x: 0, y: 10 },
          { x: 50, y: 20 },
        ],
        100
      )
    ).toBe("M 0 10 L 50 20 L 50 100 L 0 100 Z");
    expect(buildSmoothAreaPath([], 100)).toBe("");
  });
});

describe("findNearestPointIndex", () => {
  const points = [
    { x: 10, y: 0 },
    { x: 40, y: 0 },
    { x: 90, y: 0 },
  ];

  it("picks the horizontally closest point, clamping past either end", () => {
    expect(findNearestPointIndex(points, -20)).toBe(0);
    expect(findNearestPointIndex(points, 30)).toBe(1);
    expect(findNearestPointIndex(points, 70)).toBe(2);
    expect(findNearestPointIndex(points, 500)).toBe(2);
  });

  it("returns -1 without points", () => {
    expect(findNearestPointIndex([], 10)).toBe(-1);
  });
});

describe("getTooltipPosition", () => {
  const base = {
    tooltipWidth: 100,
    tooltipHeight: 40,
    containerWidth: 300,
    gap: 10,
  };

  it("centres the tooltip above the point", () => {
    expect(getTooltipPosition({ ...base, anchor: { x: 150, y: 120 } })).toEqual(
      { left: 100, top: 70, placement: "above" }
    );
  });

  it("keeps the tooltip inside the chart edges", () => {
    expect(getTooltipPosition({ ...base, anchor: { x: 5, y: 120 } }).left).toBe(
      0
    );
    expect(
      getTooltipPosition({ ...base, anchor: { x: 295, y: 120 } }).left
    ).toBe(200);
  });

  it("flips below a point that sits too close to the top", () => {
    expect(getTooltipPosition({ ...base, anchor: { x: 150, y: 30 } })).toEqual({
      left: 100,
      top: 40,
      placement: "below",
    });
  });
});
