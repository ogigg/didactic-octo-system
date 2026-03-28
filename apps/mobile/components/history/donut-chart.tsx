import { StyleSheet, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
}

function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number
): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

export function DonutChart({
  segments,
  size = 160,
  strokeWidth = 20,
}: DonutChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - strokeWidth) / 2;

  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return null;

  const GAP_DEG = segments.length > 1 ? 2 : 0;

  let currentAngle = 0;
  const arcs = segments.map((seg) => {
    const sweep = (seg.value / total) * 360 - GAP_DEG;
    const start = currentAngle + GAP_DEG / 2;
    const end = start + sweep;
    currentAngle += (seg.value / total) * 360;
    return { ...seg, start, end };
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background track */}
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="transparent"
          strokeWidth={strokeWidth}
        />
        {arcs.map((arc, idx) => (
          <Path
            key={idx}
            d={describeArc(cx, cy, r, arc.start, arc.end)}
            fill="none"
            stroke={arc.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "center",
  },
});
