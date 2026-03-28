import { useWorkoutStore } from "@/stores/workout-store";
import { useWorkoutTemplatesStore } from "@/stores/workout-templates-store";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useSaveCompletedWorkout } from "@/hooks/use-workout-mutations";
import { useWorkoutStats } from "@/hooks/use-workout-stats";
import { useExerciseMuscles } from "@/hooks/use-exercise-muscles";
import { Button } from "@/components/ui/button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { AmbientGlow } from "@/components/ambient-glow";
import { Elevation, Fonts, Radii, Spacing, Typography } from "@/constants/theme";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  computeTotalVolume,
  computeSessionStats,
  getVolumeComparison,
  getTopSet,
  formatDuration,
} from "@/lib/workout-summary-utils";
import type { WorkoutExercise } from "@/stores/workout-store";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFinishTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function useEntering(delayMs: number) {
  const reducedMotion = useReducedMotion();
  if (reducedMotion) return undefined;
  return FadeInDown.delay(delayMs).duration(500).springify().damping(18);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface StatItemProps {
  icon: "figure.strengthtraining.traditional" | "number" | "checkmark.circle.fill";
  value: string | number;
  label: string;
  color: string;
  bgColor: string;
  textColor: string;
  textMuted: string;
}

function StatItem({ icon, value, label, color, bgColor, textColor, textMuted }: StatItemProps) {
  return (
    <View
      style={[
        styles.statCard,
        { backgroundColor: bgColor },
        Elevation.sm,
      ]}
    >
      <IconSymbol name={icon} size={20} color={color} />
      <Text
        style={[
          styles.statValue,
          { color: textColor, fontFamily: Fonts?.rounded ?? undefined },
        ]}
      >
        {String(value)}
      </Text>
      <Text style={[Typography.label, { color: textMuted }]}>{label}</Text>
    </View>
  );
}

interface ExerciseRowProps {
  exercise: WorkoutExercise;
  bgColor: string;
  textColor: string;
  textSecondary: string;
  textMuted: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: TFunction<any, any>;
}

function ExerciseRow({ exercise, bgColor, textColor, textSecondary, textMuted, t }: ExerciseRowProps) {
  const completed = exercise.sets.filter((s) => s.isCompleted).length;
  const total = exercise.sets.length;
  const topSet = getTopSet(exercise.sets);

  return (
    <View style={[styles.exerciseCard, { backgroundColor: bgColor }, Elevation.sm]}>
      <Text style={[Typography.titleSm, { color: textColor }]}>{exercise.name}</Text>
      <View style={styles.exerciseMeta}>
        <Text style={[Typography.caption, { color: textSecondary }]}>
          {t("summary.exercises.setsCompleted", { completed, total })}
        </Text>
        {topSet && (
          <>
            <Text style={[Typography.caption, { color: textMuted }]}> · </Text>
            <Text style={[Typography.caption, { color: textMuted }]}>
              {t("summary.exercises.topSet", { kg: topSet.kg, reps: topSet.reps })}
            </Text>
          </>
        )}
        {!topSet && completed === 0 && (
          <Text style={[Typography.caption, { color: textMuted }]}>
            {" · "}{t("summary.exercises.noSets")}
          </Text>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function WorkoutSummaryScreen() {
  const { t } = useTranslation("workout");
  const router = useRouter();

  // Store data
  const summary = useWorkoutStore((s) => s.completedWorkoutSummary);
  const clearWorkout = useWorkoutStore((s) => s.clearWorkout);
  const addTemplate = useWorkoutTemplatesStore((s) => s.addTemplate);
  const goal = useOnboardingStore((s) => s.goal);
  const customGoal = useOnboardingStore((s) => s.customGoal);

  // Theme
  const background = useThemeColor({}, "background");
  const backgroundSubtle = useThemeColor({}, "backgroundSubtle");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const primary = useThemeColor({}, "primary");
  const primarySurface = useThemeColor({}, "primarySurface");
  const successColor = useThemeColor({}, "success");

  // Computed values
  const totalVolume = useMemo(
    () => (summary ? computeTotalVolume(summary.exercises) : 0),
    [summary]
  );
  const volumeComparison = useMemo(() => getVolumeComparison(totalVolume), [totalVolume]);
  const stats = useMemo(
    () =>
      summary
        ? computeSessionStats(summary.exercises)
        : { exerciseCount: 0, totalSets: 0, completedSets: 0, completionRate: 0 },
    [summary]
  );

  // Remote data
  const exerciseIds = useMemo(
    () => summary?.exercises.map((e) => e.id) ?? [],
    [summary]
  );
  const { muscles, isLoading: musclesLoading } = useExerciseMuscles(exerciseIds);
  const { totalWorkouts, streakWeeks, isLoading: statsLoading } = useWorkoutStats(
    summary?.finishedAtMs ?? Date.now()
  );

  // Auto-save on mount
  const saveWorkout = useSaveCompletedWorkout();
  const hasSavedRef = useRef(false);

  useEffect(() => {
    if (!summary || hasSavedRef.current) return;
    hasSavedRef.current = true;

    const goalSnapshot: "build_strength" | "lose_weight" | "improve_fitness" | "custom" =
      customGoal ? "custom" : goal ?? "improve_fitness";

    saveWorkout.mutate({
      summary,
      goalSnapshot,
      customGoalSnapshot: customGoal ?? undefined,
    });
  }, [summary]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save template
  const [saved, setSaved] = useState(false);
  const handleSaveTemplate = useCallback(() => {
    if (!summary) return;
    addTemplate({
      name: summary.workoutName,
      exercises: summary.exercises.map((e) => ({ id: e.id, name: e.name })),
    });
    setSaved(true);
  }, [summary, addTemplate]);

  const handleReturnHome = useCallback(() => {
    clearWorkout();
    router.replace("/(tabs)");
  }, [clearWorkout, router]);

  // Animation helpers
  const anim0 = useEntering(0);
  const anim1 = useEntering(80);
  const anim2 = useEntering(160);
  const anim3 = useEntering(240);
  const anim4 = useEntering(320);
  const anim5 = useEntering(400);

  // No summary guard
  if (!summary) {
    return (
      <View style={[styles.root, { backgroundColor: background }]}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.empty}>
            <Text style={[Typography.body, { color: textMuted }]}>
              No workout data available.
            </Text>
          </View>
          <View style={styles.footer}>
            <Button label={t("summary.returnHome")} onPress={handleReturnHome} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const totalWorkoutsDisplay = totalWorkouts != null ? totalWorkouts + 1 : null;

  return (
    <View style={[styles.root, { backgroundColor: background }]}>
      <AmbientGlow variant="subtle" />
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* ── 1. HERO ── */}
          <Animated.View entering={anim0} style={styles.hero}>
            <View style={[styles.checkCircle, { backgroundColor: successColor + "1A" }]}>
              <IconSymbol name="checkmark.circle.fill" size={44} color={successColor} />
            </View>
            <Text style={[Typography.displayLg, { color: textColor }]}>
              {t("summary.title")}
            </Text>
            <Text style={[Typography.body, { color: textSecondary }, styles.workoutName]}>
              {summary.workoutName}
            </Text>
            <View style={styles.heroMeta}>
              <IconSymbol name="clock" size={13} color={textMuted} />
              <Text style={[Typography.caption, { color: textMuted }]}>
                {" "}{formatDuration(summary.durationMs)}
              </Text>
              <Text style={[Typography.caption, { color: textMuted }]}> · </Text>
              <Text style={[Typography.caption, { color: textMuted }]}>
                {formatFinishTime(summary.finishedAtMs)}
              </Text>
            </View>
          </Animated.View>

          {/* ── 2. VOLUME CARD ── */}
          <Animated.View
            entering={anim1}
            style={[styles.card, { backgroundColor: backgroundSubtle }, Elevation.sm]}
          >
            <Text style={[Typography.label, { color: textMuted }]}>
              {t("summary.volume.title")}
            </Text>
            {totalVolume > 0 ? (
              <>
                <View style={styles.volumeRow}>
                  <Text
                    style={[
                      styles.volumeNumber,
                      { color: primary, fontFamily: Fonts?.rounded ?? undefined },
                    ]}
                  >
                    {totalVolume.toLocaleString()}
                  </Text>
                  <Text style={[styles.volumeUnit, { color: primary }]}>
                    {t("summary.volume.unit")}
                  </Text>
                </View>
                <Text style={[Typography.body, { color: textSecondary }, styles.comparison]}>
                  {t("summary.volume.comparison", {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    comparison: t(volumeComparison.key as any),
                  })}
                </Text>
              </>
            ) : (
              <Text
                style={[
                  styles.volumeNumber,
                  { color: primary, fontFamily: Fonts?.rounded ?? undefined },
                ]}
              >
                {t("summary.volume.bodyweight")}
              </Text>
            )}
          </Animated.View>

          {/* ── 3. MUSCLES WORKED ── */}
          {(musclesLoading || muscles.length > 0) && (
            <Animated.View entering={anim2} style={styles.section}>
              <Text style={[Typography.titleSm, { color: textColor }]}>
                {t("summary.muscles.title")}
              </Text>
              {musclesLoading ? (
                <ActivityIndicator
                  size="small"
                  color={primary}
                  style={styles.loader}
                />
              ) : (
                <View style={styles.pillsRow}>
                  {muscles.map((muscle) => (
                    <View
                      key={muscle}
                      style={[styles.pill, { backgroundColor: primarySurface }]}
                    >
                      <Text style={[Typography.caption, { color: primary }]}>
                        {muscle}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </Animated.View>
          )}

          {/* ── 4. SESSION STATS ROW ── */}
          <Animated.View entering={anim3} style={styles.statsRow}>
            <StatItem
              icon="figure.strengthtraining.traditional"
              value={stats.exerciseCount}
              label={t("summary.stats.exercises")}
              color={primary}
              bgColor={backgroundSubtle}
              textColor={textColor}
              textMuted={textMuted}
            />
            <StatItem
              icon="number"
              value={stats.totalSets}
              label={t("summary.stats.sets")}
              color={primary}
              bgColor={backgroundSubtle}
              textColor={textColor}
              textMuted={textMuted}
            />
            <StatItem
              icon="checkmark.circle.fill"
              value={`${stats.completionRate}%`}
              label={t("summary.stats.completion")}
              color={stats.completionRate === 100 ? successColor : primary}
              bgColor={backgroundSubtle}
              textColor={textColor}
              textMuted={textMuted}
            />
          </Animated.View>

          {/* ── 5. STREAK & TOTAL ── */}
          <Animated.View entering={anim4} style={styles.streakRow}>
            {/* Streak */}
            <View
              style={[
                styles.streakCard,
                { backgroundColor: backgroundSubtle },
                Elevation.sm,
              ]}
            >
              <IconSymbol name="flame.fill" size={24} color={successColor} />
              {statsLoading ? (
                <ActivityIndicator size="small" color={successColor} />
              ) : (
                <Text
                  style={[
                    styles.streakNumber,
                    { color: successColor, fontFamily: Fonts?.rounded ?? undefined },
                  ]}
                >
                  {streakWeeks ?? "—"}
                </Text>
              )}
              <Text style={[Typography.label, { color: textMuted }]}>
                {t("summary.streak.title")}
              </Text>
            </View>

            {/* Total workouts */}
            <View
              style={[
                styles.streakCard,
                { backgroundColor: backgroundSubtle },
                Elevation.sm,
              ]}
            >
              <IconSymbol name="trophy.fill" size={24} color={primary} />
              {statsLoading ? (
                <ActivityIndicator size="small" color={primary} />
              ) : (
                <Text
                  style={[
                    styles.streakNumber,
                    { color: primary, fontFamily: Fonts?.rounded ?? undefined },
                  ]}
                >
                  {totalWorkoutsDisplay ?? "—"}
                </Text>
              )}
              <Text style={[Typography.label, { color: textMuted }]}>
                {t("summary.streak.totalWorkouts")}
              </Text>
            </View>
          </Animated.View>

          {/* ── 6. EXERCISE BREAKDOWN ── */}
          <Animated.View entering={anim5} style={styles.section}>
            <Text style={[Typography.titleSm, { color: textColor }]}>
              {t("summary.exercises.title")}
            </Text>
            <View style={styles.exerciseList}>
              {summary.exercises.map((exercise) => (
                <ExerciseRow
                  key={exercise.id}
                  exercise={exercise}
                  bgColor={backgroundSubtle}
                  textColor={textColor}
                  textSecondary={textSecondary}
                  textMuted={textMuted}
                  t={t}
                />
              ))}
            </View>
          </Animated.View>
        </ScrollView>

        {/* ── FOOTER ── */}
        <View style={styles.footer}>
          {summary && (
            <Button
              label={saved ? t("saveTemplate.saved") : t("saveTemplate.save")}
              onPress={handleSaveTemplate}
              variant="secondary"
              disabled={saved}
              accessibilityLabel={saved ? t("saveTemplate.saved") : t("saveTemplate.save")}
            />
          )}
          <Button
            label={t("summary.returnHome")}
            onPress={handleReturnHome}
            accessibilityLabel={t("summary.returnHome")}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },

  scroll: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing["3xl"],
    paddingBottom: Spacing["3xl"],
    gap: Spacing["2xl"],
  },

  // Hero
  hero: {
    alignItems: "center",
    gap: Spacing.sm,
  },
  checkCircle: {
    width: 72,
    height: 72,
    borderRadius: Radii.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  workoutName: {
    textAlign: "center",
  },
  heroMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xs,
  },

  // Volume card
  card: {
    borderRadius: Radii.lg,
    padding: Spacing.xl,
    alignItems: "center",
    gap: Spacing.sm,
  },
  volumeRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.xs,
  },
  volumeNumber: {
    fontSize: 48,
    fontWeight: "700",
    letterSpacing: -1,
    lineHeight: 56,
  },
  volumeUnit: {
    fontSize: 20,
    fontWeight: "600",
    paddingBottom: Spacing.sm,
  },
  comparison: {
    textAlign: "center",
    marginTop: Spacing.xs,
  },

  // Muscles
  section: {
    gap: Spacing.md,
  },
  loader: {
    marginTop: Spacing.sm,
  },
  pillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  pill: {
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },

  // Stats row
  statsRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  statCard: {
    flex: 1,
    borderRadius: Radii.lg,
    padding: Spacing.lg,
    alignItems: "center",
    gap: Spacing.xs,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
  },

  // Streak row
  streakRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  streakCard: {
    flex: 1,
    borderRadius: Radii.lg,
    padding: Spacing.xl,
    alignItems: "center",
    gap: Spacing.sm,
  },
  streakNumber: {
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: -0.5,
  },

  // Exercise breakdown
  exerciseList: {
    gap: Spacing.sm,
  },
  exerciseCard: {
    borderRadius: Radii.lg,
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  exerciseMeta: {
    flexDirection: "row",
    alignItems: "center",
  },

  // Footer
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing["3xl"],
    paddingTop: Spacing.md,
    gap: Spacing.md,
  },

  // Empty state
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
