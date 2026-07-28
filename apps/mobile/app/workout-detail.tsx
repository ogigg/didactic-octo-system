import { AmbientGlow } from "@/components/ambient-glow";
import { MuscleDistributionCard } from "@/components/history/muscle-distribution-card";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { HeartRateChart } from "@/components/workout/heart-rate-chart";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { useHeartRateSamples } from "@/hooks/use-heart-rate-samples";
import { useThemeColor } from "@/hooks/use-theme-color";
import {
  useDeleteSessionExercise,
  useDeleteWorkoutSession,
} from "@/hooks/use-workout-mutations";
import { useWorkoutDetail } from "@/hooks/use-workout-queries";
import { useCommentsForSession } from "@/hooks/use-workout-session-comments";
import {
  useCatalogLabels,
  useLocalizedExerciseMap,
} from "@/hooks/use-exercises-query";
import type { WorkoutDetail } from "@/lib/api/workouts";
import { aggregateMuscleDistribution } from "@/lib/muscle-distribution";
import { useWeightUnit } from "@/hooks/use-weight-unit";
import { useToastStore } from "@/stores/toast-store";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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

function formatDate(dateStr: string | null, locale?: string): string {
  if (!dateStr) return "";
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dateStr));
}

function computeVolume(detail: WorkoutDetail): number {
  return detail.exercises.reduce((sum, ex) => {
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
}

function countCompletedSets(detail: WorkoutDetail): number {
  return detail.exercises.reduce(
    (sum, ex) => sum + ex.sets.filter((s) => s.log?.completed === true).length,
    0
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function WorkoutDetailScreen() {
  const { i18n, t } = useTranslation("history");
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const showSuccess = useToastStore((state) => state.showSuccess);

  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const primary = useThemeColor({}, "primary");
  const background = useThemeColor({}, "background");
  const backgroundSubtle = useThemeColor({}, "backgroundSubtle");
  const backgroundElevated = useThemeColor({}, "backgroundElevated");
  const border = useThemeColor({}, "border");
  const success = useThemeColor({}, "success");
  const error = useThemeColor({}, "error");
  const textDisabled = useThemeColor({}, "textDisabled");

  const wu = useWeightUnit();
  const { data: detail, isLoading } = useWorkoutDetail(id ?? "");
  const deleteSessionExerciseMutation = useDeleteSessionExercise();
  const deleteWorkoutSessionMutation = useDeleteWorkoutSession();
  const { data: sessionComments } = useCommentsForSession(id ?? null);
  const detailExerciseIds = useMemo(
    () => detail?.exercises.map((exercise) => exercise.exercise_id) ?? [],
    [detail]
  );
  const { exerciseMap } = useLocalizedExerciseMap(detailExerciseIds);
  const { labelMaps } = useCatalogLabels();

  const handleDeleteExercise = useCallback(
    (sessionExerciseId: string, exerciseName: string) => {
      Alert.alert(
        t("detail.deleteExercise.confirmTitle"),
        t("detail.deleteExercise.confirmMessage", { exerciseName }),
        [
          { text: t("detail.deleteExercise.cancel"), style: "cancel" },
          {
            text: t("detail.deleteExercise.remove"),
            style: "destructive",
            onPress: () =>
              deleteSessionExerciseMutation.mutate(sessionExerciseId, {
                onError: () => {
                  Alert.alert(
                    t("detail.deleteExercise.errorTitle"),
                    t("detail.deleteExercise.errorMessage")
                  );
                },
              }),
          },
        ]
      );
    },
    [deleteSessionExerciseMutation, t]
  );

  const handleDeleteWorkout = useCallback(() => {
    const workoutName = detail?.name ?? t("detail.fallbackName");
    const workoutDate =
      formatDate(
        detail?.completed_at ?? null,
        i18n.resolvedLanguage ?? i18n.language
      ) || t("detail.deleteWorkout.unknownDate");

    Alert.alert(
      t("detail.deleteWorkout.confirmTitle"),
      t("detail.deleteWorkout.confirmMessage", {
        workoutName,
        workoutDate,
      }),
      [
        { text: t("detail.deleteWorkout.cancel"), style: "cancel" },
        {
          text: t("detail.deleteWorkout.remove"),
          style: "destructive",
          onPress: () => {
            void Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Warning
            ).catch(() => {});

            deleteWorkoutSessionMutation.mutate(id ?? "", {
              onSuccess: () => {
                void Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success
                ).catch(() => {});
                showSuccess(t("detail.deleteWorkout.success"));
                router.back();
              },
              onError: () => {
                void Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Error
                ).catch(() => {});
                Alert.alert(
                  t("detail.deleteWorkout.errorTitle"),
                  t("detail.deleteWorkout.errorMessage")
                );
              },
            });
          },
        },
      ]
    );
  }, [
    deleteWorkoutSessionMutation,
    detail?.completed_at,
    detail?.name,
    id,
    i18n.language,
    i18n.resolvedLanguage,
    router,
    showSuccess,
    t,
  ]);

  // Heart rate (cache-only read from Apple Health, iOS-only)
  const hrStartedAt = useMemo(
    () => (detail?.started_at ? new Date(detail.started_at) : null),
    [detail?.started_at]
  );
  const hrEndedAt = useMemo(
    () => (detail?.completed_at ? new Date(detail.completed_at) : null),
    [detail?.completed_at]
  );
  const { data: heartRateSamples } = useHeartRateSamples(
    hrStartedAt,
    hrEndedAt
  );

  const muscleSegments = useMemo(() => {
    if (!detail) return [];
    return aggregateMuscleDistribution(
      detail.exercises.map((ex) => ({
        primaryMuscles: ex.primary_muscles.map(
          (muscle) => labelMaps.muscle.get(muscle) ?? muscle
        ),
        completedSetCount: ex.sets.filter((s) => s.log?.completed === true)
          .length,
      }))
    );
  }, [detail, labelMaps.muscle]);

  if (!id) return null;

  if (isLoading || !detail) {
    return (
      <View style={[styles.root, { backgroundColor: background }]}>
        <AmbientGlow variant="subtle" />
        <SafeAreaView style={styles.safe}>
          <View style={[styles.topBar, { borderBottomColor: border }]}>
            <BackButton />
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
      <AmbientGlow variant="subtle" />
      <SafeAreaView style={styles.safe}>
        {/* Top bar */}
        <View style={[styles.topBar, { borderBottomColor: border }]}>
          <BackButton />
          <View style={styles.topBarTitle}>
            <Text
              style={[Typography.titleSm, { color: textColor }]}
              numberOfLines={1}
            >
              {detail.name ?? t("detail.fallbackName")}
            </Text>
            <Text style={[Typography.caption, { color: textSecondary }]}>
              {formatDate(
                detail.completed_at,
                i18n.resolvedLanguage ?? i18n.language
              )}
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
                {wu.formatSpaced(computeVolume(detail))}
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
                <View style={styles.exerciseHeader}>
                  <Text
                    style={[
                      Typography.titleSm,
                      { color: textColor },
                      styles.exerciseName,
                    ]}
                  >
                    {exerciseMap.get(ex.exercise_id)?.name ?? ex.exercise_name}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t(
                      "detail.deleteExercise.accessibilityLabel",
                      {
                        exerciseName:
                          exerciseMap.get(ex.exercise_id)?.name ??
                          ex.exercise_name,
                      }
                    )}
                    disabled={deleteSessionExerciseMutation.isPending}
                    hitSlop={8}
                    onPress={() =>
                      handleDeleteExercise(
                        ex.id,
                        exerciseMap.get(ex.exercise_id)?.name ??
                          ex.exercise_name
                      )
                    }
                    style={[
                      styles.deleteExerciseButton,
                      deleteSessionExerciseMutation.isPending
                        ? styles.deleteExerciseButtonDisabled
                        : null,
                    ]}
                  >
                    <IconSymbol name="trash" size={16} color={error} />
                  </Pressable>
                </View>

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
                          {wu.formatSpaced(set.log!.actual_load_kg!)}{" "}
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

          {heartRateSamples &&
            heartRateSamples.length > 0 &&
            hrStartedAt &&
            hrEndedAt && (
              <HeartRateChart
                samples={heartRateSamples}
                startedAt={hrStartedAt}
                endedAt={hrEndedAt}
                title={t("detail.heartRate.title")}
                avgLabel={t("detail.heartRate.avg")}
                minLabel={t("detail.heartRate.min")}
                maxLabel={t("detail.heartRate.max")}
                unitLabel={t("detail.heartRate.unit")}
              />
            )}

          {sessionComments && sessionComments.length > 0 && (
            <View
              style={[
                styles.commentsCard,
                { backgroundColor: backgroundElevated, borderColor: border },
              ]}
            >
              <Text style={[Typography.titleSm, { color: textColor }]}>
                {t("detail.comments.title")}
              </Text>
              {sessionComments.map((c) => (
                <Text
                  key={c.id}
                  style={[Typography.body, { color: textSecondary }]}
                >
                  “{c.comment}”
                </Text>
              ))}
            </View>
          )}

          <MuscleDistributionCard
            segments={muscleSegments}
            title={t("detail.muscleDistribution")}
            titleColor={textColor}
            backgroundColor={backgroundElevated}
            borderColor={border}
          />

          <Button
            accessibilityLabel={t("detail.deleteWorkout.accessibilityLabel")}
            icon="trash"
            label={t(
              deleteWorkoutSessionMutation.isPending
                ? "detail.deleteWorkout.deleting"
                : "detail.deleteWorkout.button"
            )}
            loading={deleteWorkoutSessionMutation.isPending}
            onPress={handleDeleteWorkout}
            variant="destructive"
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
  topBarTitle: {
    flex: 1,
    gap: Spacing.xs,
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
    flex: 1,
    minWidth: 0,
  },
  exerciseHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  deleteExerciseButton: {
    alignItems: "center",
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  deleteExerciseButtonDisabled: {
    opacity: 0.45,
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
    borderRadius: Radii.full,
  },
  commentsCard: {
    borderRadius: Radii.md,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
});
