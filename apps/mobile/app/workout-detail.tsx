import { MuscleDistributionCard } from "@/components/history/muscle-distribution-card";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useWorkoutDetail } from "@/hooks/use-workout-queries";
import { Radii, Spacing, Typography } from "@/constants/theme";
import type { WorkoutDetail } from "@/lib/api/workouts";
import { aggregateMuscleDistribution } from "@/lib/muscle-distribution";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

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
  if (!dateStr) return "";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dateStr));
}

function formatVolume(detail: WorkoutDetail): string {
  const total = detail.exercises.reduce((sum, ex) => {
    return (
      sum +
      ex.sets.reduce((s2, set) => {
        if (
          set.log?.completed &&
          set.log.actual_load_kg != null &&
          set.log.actual_reps != null
        ) {
          return s2 + set.log.actual_load_kg * set.log.actual_reps;
        }
        return s2;
      }, 0)
    );
  }, 0);
  return (
    new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(total) +
    " kg"
  );
}

function countCompletedSets(detail: WorkoutDetail): number {
  return detail.exercises.reduce(
    (sum, ex) => sum + ex.sets.filter((s) => s.log?.completed === true).length,
    0
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function WorkoutDetailScreen() {
  const { t } = useTranslation("history");
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const primary = useThemeColor({}, "primary");
  const background = useThemeColor({}, "background");
  const backgroundSubtle = useThemeColor({}, "backgroundSubtle");
  const backgroundElevated = useThemeColor({}, "backgroundElevated");
  const border = useThemeColor({}, "border");
  const success = useThemeColor({}, "success");
  const textDisabled = useThemeColor({}, "textDisabled");

  const { data: detail, isLoading } = useWorkoutDetail(id ?? "");

  const muscleSegments = useMemo(() => {
    if (!detail) return [];
    return aggregateMuscleDistribution(
      detail.exercises.map((ex) => ({
        primaryMuscles: ex.primary_muscles,
        completedSetCount: ex.sets.filter((s) => s.log?.completed === true)
          .length,
      }))
    );
  }, [detail]);

  if (!id) return null;

  if (isLoading || !detail) {
    return (
      <View style={[styles.root, { backgroundColor: background }]}>
        <SafeAreaView style={styles.safe}>
          <View style={[styles.topBar, { borderBottomColor: border }]}>
            <Pressable
              onPress={() => router.back()}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={22} color={primary} />
            </Pressable>
          </View>
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={primary} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: background }]}>
      <SafeAreaView style={styles.safe}>
        {/* Top bar */}
        <View style={[styles.topBar, { borderBottomColor: border }]}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={22} color={primary} />
          </Pressable>
          <View style={styles.topBarTitle}>
            <Text
              style={[Typography.titleSm, { color: textColor }]}
              numberOfLines={1}
            >
              {detail.name ?? "Workout"}
            </Text>
            <Text style={[Typography.caption, { color: textSecondary }]}>
              {formatDate(detail.completed_at)}
            </Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Summary stats */}
          <View
            style={[
              styles.summaryRow,
              { backgroundColor: backgroundSubtle, borderColor: border },
            ]}
          >
            <View style={styles.summaryItem}>
              <Text style={[Typography.label, { color: textMuted }]}>
                {t("detail.summary.duration")}
              </Text>
              <Text
                style={[
                  Typography.titleMd,
                  { color: textColor, fontVariant: ["tabular-nums"] },
                ]}
              >
                {formatDuration(detail.started_at, detail.completed_at)}
              </Text>
            </View>
            <View
              style={[styles.summaryDivider, { backgroundColor: border }]}
            />
            <View style={styles.summaryItem}>
              <Text style={[Typography.label, { color: textMuted }]}>
                {t("detail.summary.volume")}
              </Text>
              <Text
                style={[
                  Typography.titleMd,
                  { color: textColor, fontVariant: ["tabular-nums"] },
                ]}
              >
                {formatVolume(detail)}
              </Text>
            </View>
            <View
              style={[styles.summaryDivider, { backgroundColor: border }]}
            />
            <View style={styles.summaryItem}>
              <Text style={[Typography.label, { color: textMuted }]}>
                {t("detail.summary.sets")}
              </Text>
              <Text
                style={[
                  Typography.titleMd,
                  { color: textColor, fontVariant: ["tabular-nums"] },
                ]}
              >
                {countCompletedSets(detail)}
              </Text>
            </View>
          </View>

          {/* Exercise sections */}
          <View style={styles.exercises}>
            {detail.exercises.map((ex) => (
              <View
                key={ex.id}
                style={[
                  styles.exerciseCard,
                  { backgroundColor: backgroundElevated, borderColor: border },
                ]}
              >
                {/* Exercise name */}
                <Text
                  style={[
                    Typography.titleSm,
                    { color: textColor },
                    styles.exerciseName,
                  ]}
                >
                  {ex.exercise_name}
                </Text>

                {/* Set rows */}
                {ex.sets.map((set) => {
                  const completed = set.log?.completed === true;
                  const hasData =
                    set.log?.actual_load_kg != null &&
                    set.log?.actual_reps != null;

                  return (
                    <View
                      key={set.id}
                      style={[
                        styles.setRow,
                        { borderTopColor: border },
                        completed && styles.setRowCompleted,
                      ]}
                    >
                      {/* Set number */}
                      <Text
                        style={[
                          Typography.caption,
                          {
                            color: completed ? textSecondary : textDisabled,
                            width: 24,
                          },
                        ]}
                      >
                        {set.set_number}.
                      </Text>

                      {/* Set data */}
                      {hasData && completed ? (
                        <Text
                          style={[
                            Typography.bodyMedium,
                            { color: textColor, fontVariant: ["tabular-nums"] },
                          ]}
                        >
                          {set.log!.actual_load_kg} kg{" "}
                          <Text style={{ color: textMuted }}>×</Text>{" "}
                          {set.log!.actual_reps}
                        </Text>
                      ) : (
                        <Text
                          style={[Typography.body, { color: textDisabled }]}
                        >
                          {t("detail.setFormatNoLog")}
                        </Text>
                      )}

                      {/* Completion indicator */}
                      {completed && (
                        <View style={styles.completedDot}>
                          <View
                            style={[styles.dot, { backgroundColor: success }]}
                          />
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>

          <MuscleDistributionCard
            segments={muscleSegments}
            title={t("detail.muscleDistribution")}
            titleColor={textColor}
            backgroundColor={backgroundElevated}
            borderColor={border}
          />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    gap: Spacing.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radii.full,
  },
  topBarTitle: {
    flex: 1,
    gap: 2,
  },
  scroll: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing["4xl"],
    gap: Spacing["2xl"],
  },
  summaryRow: {
    flexDirection: "row",
    borderRadius: Radii.md,
    borderWidth: 1,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
    gap: Spacing.xs,
  },
  summaryDivider: {
    width: 1,
    alignSelf: "stretch",
    marginHorizontal: Spacing.sm,
  },
  exercises: {
    gap: Spacing.md,
  },
  exerciseCard: {
    borderRadius: Radii.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  exerciseName: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    gap: Spacing.sm,
  },
  setRowCompleted: {
    // no background — keep uniform per ui-guidelines (no alternating rows)
  },
  completedDot: {
    flex: 1,
    alignItems: "flex-end",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
