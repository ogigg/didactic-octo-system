import { useThemeColor } from "@/hooks/use-theme-color";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { StyleSheet, Text, View } from "react-native";
import type { WorkoutSession } from "./mock-data";

interface DayCellProps {
  day: number;
  sessions: WorkoutSession[];
}

const CIRCLE_SIZE = 32;
const CELL_HEIGHT = 60;
const CELL_WIDTH_PERCENT = `${100 / 7}%` as const;

export function DayCell({ day, sessions }: DayCellProps) {
  const primary = useThemeColor({}, "primary");
  const warning = useThemeColor({}, "warning");
  const textMuted = useThemeColor({}, "textMuted");
  const textSecondary = useThemeColor({}, "textSecondary");

  const count = sessions.length;
  const hasWorkout = count > 0;
  const extraCount = count - 1;

  let accessibilityLabel = `${day}`;
  if (count === 1) {
    accessibilityLabel = `${day}, 1 workout: ${sessions[0].title}`;
  } else if (count > 1) {
    accessibilityLabel = `${day}, ${count} workouts: ${sessions.map((s) => s.title).join(", ")}`;
  }

  return (
    <View style={styles.cell} accessibilityLabel={accessibilityLabel}>
      {hasWorkout ? (
        <View style={styles.circleWrapper}>
          <View style={[styles.circle, { backgroundColor: primary }]}>
            <Text style={styles.circleText}>{day}</Text>
          </View>
          {extraCount > 0 && (
            <View style={[styles.badge, { backgroundColor: warning }]}>
              <Text style={styles.badgeText}>×{extraCount}</Text>
            </View>
          )}
        </View>
      ) : (
        <Text style={[styles.plainDay, { color: textMuted }]}>{day}</Text>
      )}
      {hasWorkout && (
        <Text
          style={[styles.sessionTitle, { color: textSecondary }]}
          numberOfLines={1}
        >
          {extraCount > 0
            ? `${sessions[0].title} +${extraCount}`
            : sessions[0].title}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
    width: CELL_WIDTH_PERCENT,
    height: CELL_HEIGHT,
    alignItems: "center",
    paddingTop: Spacing.xs,
    overflow: "visible",
  },
  circleWrapper: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    overflow: "visible",
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: Radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
  circleText: {
    ...Typography.titleSm,
    color: "#FFFFFF",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: Radii.full,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    zIndex: 1,
  },
  badgeText: {
    ...Typography.micro,
    color: "#FFFFFF",
  },
  plainDay: {
    ...Typography.titleSm,
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    textAlign: "center",
    lineHeight: CIRCLE_SIZE,
  },
  sessionTitle: {
    ...Typography.micro,
    marginTop: 2,
    maxWidth: "100%",
    textAlign: "center",
    paddingHorizontal: 2,
  },
});
