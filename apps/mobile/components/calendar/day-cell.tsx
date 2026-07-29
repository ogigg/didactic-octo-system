import { Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
} from "react-native";
import type { WorkoutSession } from "./types";

interface DayCellProps {
  day: number;
  isToday: boolean;
  sessions: WorkoutSession[];
  width: DimensionValue;
  onPress?: () => void;
}

const CIRCLE_SIZE = 32;
const CELL_HEIGHT = 60;

export function DayCell({
  day,
  isToday,
  sessions,
  width,
  onPress,
}: DayCellProps) {
  const primary = useThemeColor({}, "primary");
  const warning = useThemeColor({}, "warning");
  const textMuted = useThemeColor({}, "textMuted");
  const textSecondary = useThemeColor({}, "textSecondary");
  const primarySurface = useThemeColor({}, "primarySurface");

  const count = sessions.length;
  const hasWorkout = count > 0;
  const extraCount = count - 1;

  let accessibilityLabel = `${day}`;
  if (count === 1) {
    accessibilityLabel = `${day}, 1 workout: ${sessions[0].title}`;
  } else if (count > 1) {
    accessibilityLabel = `${day}, ${count} workouts: ${sessions.map((s) => s.title).join(", ")}`;
  }

  const body = (
    <>
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
      ) : isToday ? (
        <View style={[styles.circle, { backgroundColor: primarySurface }]}>
          <Text style={[styles.circleText, { color: primary }]}>{day}</Text>
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
    </>
  );

  if (hasWorkout && onPress) {
    return (
      <Pressable
        style={[styles.cell, { width }]}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        onPress={onPress}
      >
        {body}
      </Pressable>
    );
  }

  return (
    <View
      style={[styles.cell, { width }]}
      accessibilityLabel={accessibilityLabel}
    >
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
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
