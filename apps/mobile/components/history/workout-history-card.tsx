import { useThemeColor } from "@/hooks/use-theme-color";
import { Radii, Spacing, Typography } from "@/constants/theme";
import type { WorkoutHistoryItem } from "@/lib/api/workouts";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface WorkoutHistoryCardProps {
  item: WorkoutHistoryItem;
  onPress: () => void;
}

function formatDuration(
  startedAt: string | null,
  completedAt: string | null
): string {
  if (!startedAt || !completedAt) return "—";
  const diffMs =
    new Date(completedAt).getTime() - new Date(startedAt).getTime();
  const totalMinutes = Math.round(diffMs / 60000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dateStr));
}

function formatVolume(kg: number): string {
  return (
    new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(kg) +
    " kg"
  );
}

export function WorkoutHistoryCard({ item, onPress }: WorkoutHistoryCardProps) {
  const { t } = useTranslation("history");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const primary = useThemeColor({}, "primary");
  const backgroundElevated = useThemeColor({}, "backgroundElevated");
  const border = useThemeColor({}, "border");

  const MAX_EXERCISES = 3;
  const visibleExercises = item.exercise_names.slice(0, MAX_EXERCISES);
  const remainingCount = item.exercise_names.length - MAX_EXERCISES;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: backgroundElevated, borderColor: border },
      ]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${item.name ?? "Workout"}, ${formatDate(item.completed_at)}`}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text
          style={[Typography.titleSm, { color: textColor }]}
          numberOfLines={1}
        >
          {item.name ?? "Workout"}
        </Text>
        <Text style={[Typography.caption, { color: textSecondary }]}>
          {formatDate(item.completed_at)}
        </Text>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={[Typography.label, { color: textMuted }]}>
            {t("card.duration")}
          </Text>
          <Text
            style={[
              Typography.bodyMedium,
              { color: textColor, fontVariant: ["tabular-nums"] },
            ]}
          >
            {formatDuration(item.started_at, item.completed_at)}
          </Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: border }]} />
        <View style={styles.statItem}>
          <Text style={[Typography.label, { color: textMuted }]}>
            {t("card.volume")}
          </Text>
          <Text
            style={[
              Typography.bodyMedium,
              { color: textColor, fontVariant: ["tabular-nums"] },
            ]}
          >
            {formatVolume(item.total_volume_kg)}
          </Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: border }]} />
        <View style={styles.statItem}>
          <Text style={[Typography.label, { color: textMuted }]}>
            {t("card.sets")}
          </Text>
          <Text
            style={[
              Typography.bodyMedium,
              { color: textColor, fontVariant: ["tabular-nums"] },
            ]}
          >
            {item.total_sets}
          </Text>
        </View>
      </View>

      {/* Exercise list */}
      {visibleExercises.length > 0 && (
        <View style={[styles.exercises, { borderTopColor: border }]}>
          {visibleExercises.map((name, idx) => (
            <Text
              key={idx}
              style={[Typography.caption, { color: textSecondary }]}
              numberOfLines={1}
            >
              {name}
            </Text>
          ))}
          {remainingCount > 0 && (
            <Text style={[Typography.caption, { color: primary }]}>
              {t("card.moreExercises", { count: remainingCount })}
            </Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.xs,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  statItem: {
    flex: 1,
    gap: Spacing.xs,
  },
  statDivider: {
    width: 1,
    height: 28,
    marginHorizontal: Spacing.md,
  },
  exercises: {
    borderTopWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
  },
});
