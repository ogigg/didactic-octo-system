import { useTranslation } from "react-i18next";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
} from "react-native";
import type { StreakWeekStatus } from "@/lib/streak-calendar";
import type { WorkoutSession } from "./types";

interface DayCellProps {
  day: number;
  isToday: boolean;
  sessions: WorkoutSession[];
  width: DimensionValue;
  onPress?: () => void;
  dateKey?: string;
  weekStart?: string;
  weekStatus?: StreakWeekStatus;
  weekStatusLabel?: string;
  bandStart?: boolean;
  bandEnd?: boolean;
  showWeekMarker?: boolean;
  isFreezeDay?: boolean;
}

const CIRCLE_SIZE = 32;
const CELL_HEIGHT = 60;

export function DayCell({
  day,
  isToday,
  sessions,
  width,
  onPress,
  dateKey,
  weekStart,
  weekStatus,
  weekStatusLabel,
  bandStart,
  bandEnd,
  showWeekMarker,
  isFreezeDay = false,
}: DayCellProps) {
  const { t } = useTranslation("calendar");
  const primary = useThemeColor({}, "primary");
  const warning = useThemeColor({}, "warning");
  const textMuted = useThemeColor({}, "textMuted");
  const textSecondary = useThemeColor({}, "textSecondary");
  const primarySurface = useThemeColor({}, "primarySurface");
  const error = useThemeColor({}, "error");

  const count = sessions.length;
  const hasWorkout = count > 0;
  const extraCount = count - 1;

  let accessibilityLabel = `${day}`;
  if (count === 1) {
    accessibilityLabel = `${day}, 1 workout: ${sessions[0].title}`;
  } else if (count > 1) {
    accessibilityLabel = `${day}, ${count} workouts: ${sessions.map((s) => s.title).join(", ")}`;
  }
  if (weekStatusLabel) {
    accessibilityLabel += `, ${weekStatusLabel}`;
  }

  if (isFreezeDay) accessibilityLabel += `, ${t("freezeUsed")}`;
  if (isToday) accessibilityLabel += `, ${t("today")}`;

  const weekStatusColor = weekStatus === "ruined" ? error : primary;
  const weekHighlightTestID =
    weekStatus && weekStart
      ? `calendar-week-highlight-${weekStatus}-${weekStart}`
      : undefined;

  const body = (
    <>
      {weekStatus && (
        <View
          pointerEvents="none"
          testID={weekHighlightTestID}
          style={[
            styles.weekHighlight,
            {
              backgroundColor: `${weekStatusColor}${weekStatus === "covered" ? "24" : "10"}`,
            },
            bandStart && {
              left: 2,
              borderTopLeftRadius: Radii.full,
              borderBottomLeftRadius: Radii.full,
            },
            bandEnd && {
              right: 2,
              borderTopRightRadius: Radii.full,
              borderBottomRightRadius: Radii.full,
            },
          ]}
        />
      )}
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
      ) : (weekStatus === "covered" && showWeekMarker) || isFreezeDay ? (
        <View style={styles.circleWrapper}>
          <View
            style={[
              styles.circle,
              styles.weekMarker,
              {
                backgroundColor: primarySurface,
                borderColor: primary,
              },
            ]}
          >
            <Text style={[styles.circleText, { color: primary }]}>{day}</Text>
          </View>
          <View
            testID="calendar-freeze-marker"
            style={[styles.statusBadge, { backgroundColor: primary }]}
          >
            <IconSymbol name="snowflake" size={10} color="#FFFFFF" />
          </View>
        </View>
      ) : isToday ? (
        <View style={[styles.circle, { backgroundColor: primarySurface }]}>
          <Text style={[styles.circleText, { color: primary }]}>{day}</Text>
        </View>
      ) : (
        <Text
          style={[
            styles.plainDay,
            { color: weekStatus ? weekStatusColor : textMuted },
            weekStatus && styles.streakDay,
          ]}
        >
          {day}
        </Text>
      )}
      {isToday && (
        <View
          pointerEvents="none"
          testID="calendar-today-marker"
          style={[styles.todayOutline, { borderColor: primary }]}
        />
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
        testID={dateKey ? `calendar-day-${dateKey}` : undefined}
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
      testID={dateKey ? `calendar-day-${dateKey}` : undefined}
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
  weekHighlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 40,
  },
  todayOutline: {
    position: "absolute",
    top: 0,
    alignSelf: "center",
    width: CIRCLE_SIZE + 8,
    height: CIRCLE_SIZE + 8,
    borderRadius: Radii.full,
    borderWidth: 2,
  },
  streakDay: {
    fontWeight: "700",
  },
  weekMarker: {
    borderWidth: 2,
  },
  statusBadge: {
    position: "absolute",
    top: -3,
    right: -3,
    width: 15,
    height: 15,
    borderRadius: Radii.full,
    alignItems: "center",
    justifyContent: "center",
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
