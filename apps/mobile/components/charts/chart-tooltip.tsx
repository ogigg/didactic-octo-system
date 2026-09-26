import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Elevation, Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { getTooltipPosition, type ChartPoint } from "@/lib/chart-geometry";

interface ChartTooltipProps {
  /** The inspected point, in the chart container's coordinates. */
  anchor: ChartPoint;
  containerWidth: number;
  value: string;
  /** Secondary line under the value, e.g. the date or time. */
  caption: string;
  /** Optional accent line, e.g. the change since the previous point. */
  detail?: string;
}

const GAP = 16;

/** Floating readout that follows the inspected point inside the chart. */
export function ChartTooltip({
  anchor,
  containerWidth,
  value,
  caption,
  detail,
}: ChartTooltipProps) {
  const text = useThemeColor({}, "text");
  const textMuted = useThemeColor({}, "textMuted");
  const textSecondary = useThemeColor({}, "textSecondary");
  const border = useThemeColor({}, "border");
  const backgroundElevated = useThemeColor({}, "backgroundElevated");
  const [size, setSize] = useState({ width: 0, height: 0 });

  const { left, top } = getTooltipPosition({
    anchor,
    tooltipWidth: size.width,
    tooltipHeight: size.height,
    containerWidth,
    gap: GAP,
  });

  return (
    <View
      testID="chart-tooltip"
      pointerEvents="none"
      onLayout={({ nativeEvent: { layout } }) =>
        // Moving the tooltip re-fires onLayout; skip the render if the size held.
        setSize((current) =>
          current.width === layout.width && current.height === layout.height
            ? current
            : { width: layout.width, height: layout.height }
        )
      }
      style={[
        styles.tooltip,
        {
          left,
          top,
          backgroundColor: backgroundElevated,
          borderColor: border,
          // Hidden for the first frame, until it's measured and placed.
          opacity: size.width > 0 ? 1 : 0,
        },
      ]}
    >
      <Text style={[Typography.titleSm, styles.value, { color: text }]}>
        {value}
      </Text>
      {detail ? (
        <Text
          style={[Typography.caption, styles.value, { color: textSecondary }]}
        >
          {detail}
        </Text>
      ) : null}
      <Text style={[Typography.caption, { color: textMuted }]}>{caption}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tooltip: {
    ...Elevation.md,
    position: "absolute",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 2,
  },
  value: {
    fontVariant: ["tabular-nums"],
  },
});
