import { Circle, G, Line } from "react-native-svg";

import type { ChartPoint } from "@/lib/chart-geometry";

interface ChartCrosshairProps {
  point: ChartPoint;
  /** Vertical extent of the dashed guide, usually the plot's top and bottom. */
  top: number;
  bottom: number;
  color: string;
  guideColor: string;
  /** Ring around the dot so it reads on top of the line and the fill. */
  surfaceColor: string;
}

/** Dashed vertical guide with a haloed dot marking the inspected point. */
export function ChartCrosshair({
  point,
  top,
  bottom,
  color,
  guideColor,
  surfaceColor,
}: ChartCrosshairProps) {
  return (
    <G testID="chart-crosshair">
      <Line
        x1={point.x}
        y1={top}
        x2={point.x}
        y2={bottom}
        stroke={guideColor}
        strokeWidth={1}
        strokeDasharray="3 4"
        strokeLinecap="round"
      />
      <Circle cx={point.x} cy={point.y} r={12} fill={color} opacity={0.16} />
      <Circle
        cx={point.x}
        cy={point.y}
        r={5.5}
        fill={color}
        stroke={surfaceColor}
        strokeWidth={2.5}
      />
    </G>
  );
}
