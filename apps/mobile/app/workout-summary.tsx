import { MuscleDistributionCard } from "@/components/history/muscle-distribution-card";
import { HeartRateChart } from "@/components/workout/heart-rate-chart";
import { useHeartRateSamples } from "@/hooks/use-heart-rate-samples";
import { useWorkoutStore } from "@/stores/workout-store";
import { useWorkoutTemplatesStore } from "@/stores/workout-templates-store";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useSaveCompletedWorkout } from "@/hooks/use-workout-mutations";
import { useWorkoutStats } from "@/hooks/use-workout-stats";
import { useExerciseMuscles } from "@/hooks/use-exercise-muscles";
import {
  useCatalogLabels,
  useLocalizedExerciseMap,
} from "@/hooks/use-exercises-query";
import { aggregateMuscleDistribution } from "@/lib/muscle-distribution";
import { Button } from "@/components/ui/button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { AmbientGlow } from "@/components/ambient-glow";
import {
  Elevation,
  Fonts,
  Opacity,
  Radii,
  Spacing,
  Typography,
} from "@/constants/theme";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  FadeInDown,
  useReducedMotion,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  computeTotalVolume,
  computeSessionStats,
  getVolumeComparison,
  getTopSet,
  getBestDurationSeconds,
  formatDuration,
} from "@/lib/workout-summary-utils";
import { formatExerciseDuration } from "@/lib/format-exercise-duration";
import type { WorkoutExercise } from "@/stores/workout-store";
import { useWeightUnit } from "@/hooks/use-weight-unit";
import { trackEvent } from "@/lib/track-event";
import { useCreateWorkoutSessionComment } from "@/hooks/use-workout-session-comments";
import { MAX_COMMENT_LENGTH } from "@/lib/api/workout-session-comments";

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
  icon:
    | "figure.strengthtraining.traditional"
    | "number"
    | "checkmark.circle.fill";
  value: string | number;
  label: string;
  color: string;
  bgColor: string;
  textColor: string;
  textMuted: string;
}

function StatItem({
  icon,
  value,
  label,
  color,
  bgColor,
  textColor,
  textMuted,
}: StatItemProps) {
  return (
    <View style={[styles.statCard, { backgroundColor: bgColor }, Elevation.sm]}>
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
  displayName: string;
  bgColor: string;
  textColor: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primarySurface: string;
  primaryContainer: string;
  border: string;
  onFeedbackChange: (exerciseId: string, feedback: DifficultyValue) => void;
  formatWeight: (kg: number) => string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: TFunction<any, any>;
}

type DifficultyValue = "too_easy" | "ok" | "too_hard";

const DIFFICULTY_OPTIONS: {
  value: DifficultyValue;
  emoji: string;
}[] = [
  { value: "too_easy", emoji: "😊" },
  { value: "ok", emoji: "💪" },
  { value: "too_hard", emoji: "😤" },
];

function ExerciseRow({
  exercise,
  displayName,
  bgColor,
  textColor,
  textSecondary,
  textMuted,
  primary,
  primarySurface,
  primaryContainer,
  border,
  onFeedbackChange,
  formatWeight,
  t,
}: ExerciseRowProps) {
  const [feedback, setFeedback] = useState<DifficultyValue | null>(
    exercise.difficultyFeedback
  );

  const completed = exercise.sets.filter((s) => s.isCompleted).length;
  const total = exercise.sets.length;
  const isTimeExercise = exercise.exerciseType === "time";
  const topSet = isTimeExercise ? null : getTopSet(exercise.sets);
  const bestDuration = isTimeExercise
    ? getBestDurationSeconds(exercise.sets)
    : null;
  const hasCompletedSets = completed > 0;

  const handleFeedback = useCallback(
    (value: DifficultyValue) => {
      setFeedback(value);
      onFeedbackChange(exercise.id, value);
      trackEvent("difficulty_feedback_given", {
        exercise_id: exercise.id,
        exercise_name: displayName,
        feedback: value,
      });
    },
    [displayName, exercise.id, onFeedbackChange]
  );

  return (
    <View
      style={[styles.exerciseCard, { backgroundColor: bgColor }, Elevation.sm]}
    >
      <Text style={[Typography.titleSm, { color: textColor }]}>
        {displayName}
      </Text>
      <View style={styles.exerciseMeta}>
        <Text style={[Typography.caption, { color: textSecondary }]}>
          {t("summary.exercises.setsCompleted", { completed, total })}
        </Text>
        {topSet && (
          <>
            <Text style={[Typography.caption, { color: textMuted }]}> · </Text>
            <Text style={[Typography.caption, { color: textMuted }]}>
              {t("summary.exercises.topSet", {
                weight: formatWeight(topSet.kg),
                reps: topSet.reps,
              })}
            </Text>
          </>
        )}
        {bestDuration != null && (
          <>
            <Text style={[Typography.caption, { color: textMuted }]}> · </Text>
            <Text style={[Typography.caption, { color: textMuted }]}>
              {t("summary.exercises.topDuration", {
                time: formatExerciseDuration(bestDuration),
              })}
            </Text>
          </>
        )}
        {!topSet && !bestDuration && completed === 0 && (
          <Text style={[Typography.caption, { color: textMuted }]}>
            {" · "}
            {t("summary.exercises.noSets")}
          </Text>
        )}
      </View>

      {/* Difficulty feedback */}
      {hasCompletedSets && (
        <View style={styles.feedbackSection}>
          <Text style={[Typography.caption, { color: textMuted }]}>
            {t("difficulty.title")}
          </Text>
          <View style={styles.feedbackRow}>
            {DIFFICULTY_OPTIONS.map((opt) => {
              const isSelected = feedback === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => handleFeedback(opt.value)}
                  style={({ pressed }) => [
                    styles.feedbackButton,
                    {
                      backgroundColor: isSelected
                        ? primarySurface
                        : primaryContainer,
                      borderColor: isSelected ? primary : "transparent",
                      borderWidth: isSelected ? 1.5 : 0,
                      opacity: pressed ? Opacity.pressed : 1,
                    },
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={t(
                    `difficulty.${opt.value === "too_easy" ? "tooEasy" : opt.value === "too_hard" ? "tooHard" : "ok"}`
                  )}
                >
                  <Text style={styles.feedbackEmoji}>{opt.emoji}</Text>
                  <Text
                    style={[
                      Typography.micro,
                      {
                        color: isSelected ? primary : textSecondary,
                      },
                    ]}
                  >
                    {t(
                      `difficulty.${opt.value === "too_easy" ? "tooEasy" : opt.value === "too_hard" ? "tooHard" : "ok"}`
                    )}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Session comment
// ---------------------------------------------------------------------------

const COMMENT_CHIPS = [
  { key: "moreLegs", phrase: "More legs" },
  { key: "moreUpperBody", phrase: "More upper body" },
  { key: "lessCardio", phrase: "Less cardio" },
  { key: "moreCardio", phrase: "More cardio" },
  { key: "shorterSessions", phrase: "Shorter sessions" },
  { key: "moreCore", phrase: "More core" },
] as const;

type CommentChipKey = (typeof COMMENT_CHIPS)[number]["key"];

interface SessionCommentCardProps {
  sessionId: string | null;
  bgColor: string;
  textColor: string;
  textMuted: string;
  textSecondary: string;
  primary: string;
  primarySurface: string;
  primaryContainer: string;
  border: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: TFunction<any, any>;
  onSaved?: () => void;
}

function SessionCommentCard({
  sessionId,
  bgColor,
  textColor,
  textMuted,
  textSecondary,
  primary,
  primarySurface,
  primaryContainer,
  border,
  t,
  onSaved,
}: SessionCommentCardProps) {
  const [text, setText] = useState("");
  const [selected, setSelected] = useState<Set<CommentChipKey>>(new Set());
  const [saved, setSaved] = useState(false);
  const createComment = useCreateWorkoutSessionComment();

  const buildPayload = useCallback((): string => {
    const chipPhrases = COMMENT_CHIPS.filter((c) => selected.has(c.key)).map(
      (c) => c.phrase
    );
    const parts: string[] = [];
    if (chipPhrases.length) parts.push(chipPhrases.join(", "));
    const trimmed = text.trim();
    if (trimmed) parts.push(trimmed);
    return parts.join(". ").slice(0, MAX_COMMENT_LENGTH);
  }, [selected, text]);

  const hasContent = selected.size > 0 || text.trim().length > 0;

  const submit = useCallback(async () => {
    if (!sessionId || !hasContent || saved) return;
    const comment = buildPayload();
    if (!comment) return;
    await createComment.mutateAsync({ sessionId, comment });
    setSaved(true);
    trackEvent("workout_comment_submitted", {
      session_id: sessionId,
      length: comment.length,
      chip_count: selected.size,
      has_freeform: text.trim().length > 0,
    });
    onSaved?.();
  }, [
    sessionId,
    hasContent,
    saved,
    buildPayload,
    createComment,
    selected.size,
    text,
    onSaved,
  ]);

  const toggleChip = useCallback((key: CommentChipKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const disabled =
    !sessionId || !hasContent || saved || createComment.isPending;

  return (
    <View
      style={[styles.commentCard, { backgroundColor: bgColor }, Elevation.sm]}
    >
      <Text style={[Typography.titleSm, { color: textColor }]}>
        {t("sessionComment.title")}
      </Text>
      <Text style={[Typography.caption, { color: textMuted }]}>
        {t("sessionComment.subtitle")}
      </Text>

      <View style={styles.chipRow}>
        {COMMENT_CHIPS.map((chip) => {
          const isSelected = selected.has(chip.key);
          return (
            <Pressable
              key={chip.key}
              onPress={() => toggleChip(chip.key)}
              disabled={saved}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected, disabled: saved }}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: isSelected
                    ? primarySurface
                    : primaryContainer,
                  borderColor: isSelected ? primary : "transparent",
                  borderWidth: isSelected ? 1.5 : 0,
                  opacity: pressed ? Opacity.pressed : saved ? 0.6 : 1,
                },
              ]}
            >
              <Text
                style={[
                  Typography.caption,
                  { color: isSelected ? primary : textSecondary },
                ]}
              >
                {t(`sessionComment.chips.${chip.key}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        value={text}
        onChangeText={setText}
        editable={!saved}
        placeholder={t("sessionComment.placeholder")}
        placeholderTextColor={textMuted}
        multiline
        maxLength={MAX_COMMENT_LENGTH}
        style={[
          styles.commentInput,
          {
            color: textColor,
            backgroundColor: primaryContainer,
            borderColor: border,
          },
        ]}
        accessibilityLabel={t("sessionComment.placeholder")}
      />

      <View style={styles.commentFooter}>
        <Text style={[Typography.micro, { color: textMuted }]}>
          {t("sessionComment.counter", {
            count: text.length,
            max: MAX_COMMENT_LENGTH,
          })}
        </Text>
        <Button
          label={saved ? t("sessionComment.saved") : t("sessionComment.save")}
          onPress={() => {
            Keyboard.dismiss();
            submit();
          }}
          variant="secondary"
          disabled={disabled}
          accessibilityLabel={
            saved ? t("sessionComment.saved") : t("sessionComment.save")
          }
        />
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
  const setExerciseDifficultyFeedback = useWorkoutStore(
    (s) => s.setExerciseDifficultyFeedback
  );
  const addTemplate = useWorkoutTemplatesStore((s) => s.addTemplate);
  const goal = useOnboardingStore((s) => s.goal);
  const customGoal = useOnboardingStore((s) => s.customGoal);

  // Units
  const wu = useWeightUnit();

  // Theme
  const background = useThemeColor({}, "background");
  const backgroundSubtle = useThemeColor({}, "backgroundSubtle");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const primary = useThemeColor({}, "primary");
  const primarySurface = useThemeColor({}, "primarySurface");
  const primaryContainer = useThemeColor({}, "primaryContainer");
  const successColor = useThemeColor({}, "success");
  const border = useThemeColor({}, "border");

  // Computed values
  const totalVolume = useMemo(
    () => (summary ? computeTotalVolume(summary.exercises) : 0),
    [summary]
  );
  const volumeComparison = useMemo(
    () => getVolumeComparison(totalVolume),
    [totalVolume]
  );
  const stats = useMemo(
    () =>
      summary
        ? computeSessionStats(summary.exercises)
        : {
            exerciseCount: 0,
            totalSets: 0,
            completedSets: 0,
            completionRate: 0,
          },
    [summary]
  );

  // Remote data
  const exerciseIds = useMemo(
    () => summary?.exercises.map((e) => e.id) ?? [],
    [summary]
  );
  const { primaryMusclesByExerciseId, isLoading: musclesLoading } =
    useExerciseMuscles(exerciseIds);
  const { exerciseMap } = useLocalizedExerciseMap(exerciseIds);
  const { labelMaps } = useCatalogLabels();
  const {
    totalWorkouts,
    streakWeeks,
    isLoading: statsLoading,
  } = useWorkoutStats(summary?.finishedAtMs ?? Date.now());

  // Heart rate (cache-only read from Apple Health, iOS-only)
  const hrStartedAt = useMemo(
    () =>
      summary ? new Date(summary.finishedAtMs - summary.durationMs) : null,
    [summary]
  );
  const hrEndedAt = useMemo(
    () => (summary ? new Date(summary.finishedAtMs) : null),
    [summary]
  );
  const { data: heartRateSamples } = useHeartRateSamples(
    hrStartedAt,
    hrEndedAt
  );

  const muscleSegments = useMemo(() => {
    if (!summary) return [];
    return aggregateMuscleDistribution(
      summary.exercises.map((ex) => ({
        primaryMuscles: (primaryMusclesByExerciseId[ex.id] ?? []).map(
          (muscle) => labelMaps.muscle.get(muscle) ?? muscle
        ),
        completedSetCount: ex.sets.filter((s) => s.isCompleted).length,
      }))
    );
  }, [summary, primaryMusclesByExerciseId, labelMaps.muscle]);

  // Auto-save on mount
  const saveWorkout = useSaveCompletedWorkout();
  const hasSavedRef = useRef(false);
  const savedSessionId = saveWorkout.data?.id ?? null;

  useEffect(() => {
    if (!summary || hasSavedRef.current) return;
    hasSavedRef.current = true;

    const goalSnapshot:
      | "build_strength"
      | "lose_weight"
      | "improve_fitness"
      | "custom" = customGoal ? "custom" : (goal ?? "improve_fitness");

    saveWorkout.mutate(
      {
        summary,
        goalSnapshot,
        customGoalSnapshot: customGoal ?? undefined,
        weightUnit: wu.unit,
      },
      {
        onSuccess: () => {
          // Track workout completion events after successful save
          const sessionStats = computeSessionStats(summary.exercises);
          const totalVolume = computeTotalVolume(summary.exercises);

          // Track workout completion
          trackEvent("workout_completed", {
            workout_name: summary.workoutName,
            exercise_count: stats.exerciseCount,
            total_sets: stats.totalSets,
            completed_sets: stats.completedSets,
            completion_rate: stats.completionRate,
            total_volume_kg: totalVolume,
            duration_seconds: Math.floor(summary.durationMs / 1000),
            goal_snapshot: goalSnapshot,
            custom_goal_snapshot: customGoal ?? null,
          });

          // Track session duration
          trackEvent("session_duration", {
            workout_name: summary.workoutName,
            duration_seconds: Math.floor(summary.durationMs / 1000),
            exercise_count: stats.exerciseCount,
            completion_rate: stats.completionRate,
          });
        },
      }
    );
  }, [summary]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save template
  const [saved, setSaved] = useState(false);
  const handleSaveTemplate = useCallback(() => {
    if (!summary) return;
    addTemplate({
      name: summary.workoutName,
      exercises: summary.exercises.map((e) => ({
        id: e.id,
        name: exerciseMap.get(e.id)?.name ?? e.name,
      })),
    });
    setSaved(true);
  }, [summary, addTemplate, exerciseMap]);

  const handleReturnHome = useCallback(() => {
    clearWorkout();
    router.dismiss(2);
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
        <SafeAreaProvider>
          <SafeAreaView style={styles.safe}>
            <View style={styles.empty}>
              <Text style={[Typography.body, { color: textMuted }]}>
                No workout data available.
              </Text>
            </View>
            <View style={styles.footer}>
              <Button
                label={t("summary.returnHome")}
                onPress={handleReturnHome}
              />
            </View>
          </SafeAreaView>
        </SafeAreaProvider>
      </View>
    );
  }

  const totalWorkoutsDisplay = totalWorkouts != null ? totalWorkouts + 1 : null;

  return (
    <View style={[styles.root, { backgroundColor: background }]}>
      <AmbientGlow variant="subtle" />
      <SafeAreaProvider>
        <SafeAreaView style={styles.safe}>
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <ScrollView
              contentContainerStyle={styles.scroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* ── 1. HERO ── */}
              <Animated.View entering={anim0} style={styles.hero}>
                <View
                  style={[
                    styles.checkCircle,
                    { backgroundColor: successColor + "1A" },
                  ]}
                >
                  <IconSymbol
                    name="checkmark.circle.fill"
                    size={44}
                    color={successColor}
                  />
                </View>
                <Text style={[Typography.displayLg, { color: textColor }]}>
                  {t("summary.title")}
                </Text>
                <Text
                  style={[
                    Typography.body,
                    { color: textSecondary },
                    styles.workoutName,
                  ]}
                >
                  {summary.workoutName}
                </Text>
                <View style={styles.heroMeta}>
                  <IconSymbol name="clock" size={13} color={textMuted} />
                  <Text style={[Typography.caption, { color: textMuted }]}>
                    {" "}
                    {formatDuration(summary.durationMs)}
                  </Text>
                  <Text style={[Typography.caption, { color: textMuted }]}>
                    {" "}
                    ·{" "}
                  </Text>
                  <Text style={[Typography.caption, { color: textMuted }]}>
                    {formatFinishTime(summary.finishedAtMs)}
                  </Text>
                </View>
              </Animated.View>

              {/* ── 2. VOLUME CARD ── */}
              <Animated.View
                entering={anim1}
                style={[
                  styles.card,
                  { backgroundColor: backgroundSubtle },
                  Elevation.sm,
                ]}
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
                          {
                            color: primary,
                            fontFamily: Fonts?.rounded ?? undefined,
                          },
                        ]}
                      >
                        {Math.round(wu.convert(totalVolume)).toLocaleString()}
                      </Text>
                      <Text style={[styles.volumeUnit, { color: primary }]}>
                        {t("summary.volume.unit", { unit: wu.label })}
                      </Text>
                    </View>
                    <Text
                      style={[
                        Typography.body,
                        { color: textSecondary },
                        styles.comparison,
                      ]}
                    >
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
                      {
                        color: primary,
                        fontFamily: Fonts?.rounded ?? undefined,
                      },
                    ]}
                  >
                    {t("summary.volume.bodyweight")}
                  </Text>
                )}
              </Animated.View>

              {/* ── 3. MUSCLE DISTRIBUTION ── */}
              {(musclesLoading || muscleSegments.length > 0) && (
                <Animated.View entering={anim2} style={styles.section}>
                  {musclesLoading ? (
                    <>
                      <Text style={[Typography.titleMd, { color: textColor }]}>
                        {t("summary.muscleDistribution")}
                      </Text>
                      <ActivityIndicator
                        size="small"
                        color={primary}
                        style={styles.loader}
                      />
                    </>
                  ) : (
                    <View style={[Elevation.sm, styles.muscleCardWrap]}>
                      <MuscleDistributionCard
                        segments={muscleSegments}
                        title={t("summary.muscleDistribution")}
                        titleColor={textColor}
                        backgroundColor={backgroundSubtle}
                        borderColor={backgroundSubtle}
                        showBorder={false}
                      />
                    </View>
                  )}
                </Animated.View>
              )}

              {/* ── 3.5 HEART RATE (iOS only, cache-only) ── */}
              {heartRateSamples &&
                heartRateSamples.length > 0 &&
                hrStartedAt &&
                hrEndedAt && (
                  <Animated.View entering={anim2}>
                    <HeartRateChart
                      samples={heartRateSamples}
                      startedAt={hrStartedAt}
                      endedAt={hrEndedAt}
                      title={t("summary.heartRate.title")}
                      avgLabel={t("summary.heartRate.avg")}
                      minLabel={t("summary.heartRate.min")}
                      maxLabel={t("summary.heartRate.max")}
                      unitLabel={t("summary.heartRate.unit")}
                    />
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
                  <IconSymbol
                    name="flame.fill"
                    size={24}
                    color={successColor}
                  />
                  {statsLoading ? (
                    <ActivityIndicator size="small" color={successColor} />
                  ) : (
                    <Text
                      style={[
                        styles.streakNumber,
                        {
                          color: successColor,
                          fontFamily: Fonts?.rounded ?? undefined,
                        },
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
                        {
                          color: primary,
                          fontFamily: Fonts?.rounded ?? undefined,
                        },
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
                      displayName={
                        exerciseMap.get(exercise.id)?.name ?? exercise.name
                      }
                      bgColor={backgroundSubtle}
                      textColor={textColor}
                      textSecondary={textSecondary}
                      textMuted={textMuted}
                      primary={primary}
                      primarySurface={primarySurface}
                      primaryContainer={primaryContainer}
                      border={border}
                      onFeedbackChange={setExerciseDifficultyFeedback}
                      formatWeight={wu.format}
                      t={t}
                    />
                  ))}
                </View>
              </Animated.View>

              {/* ── 6.5 SESSION COMMENT ── */}
              {saveWorkout.isSuccess && savedSessionId && (
                <Animated.View entering={anim5}>
                  <SessionCommentCard
                    sessionId={savedSessionId}
                    bgColor={backgroundSubtle}
                    textColor={textColor}
                    textMuted={textMuted}
                    textSecondary={textSecondary}
                    primary={primary}
                    primarySurface={primarySurface}
                    primaryContainer={primaryContainer}
                    border={border}
                    t={t}
                  />
                </Animated.View>
              )}

              {/* ── 7. NEXT WORKOUT PREPARING ── */}
              {saveWorkout.isSuccess && (
                <View
                  style={[
                    styles.preparingCard,
                    { backgroundColor: primarySurface },
                  ]}
                >
                  <IconSymbol name="flame" size={16} color={primary} />
                  <Text style={[Typography.bodyMedium, { color: primary }]}>
                    {t("nextWorkout.preparing")}
                  </Text>
                </View>
              )}
            </ScrollView>
          </KeyboardAvoidingView>

          {/* ── FOOTER ── */}
          <View style={styles.footer}>
            {summary && (
              <Button
                label={saved ? t("saveTemplate.saved") : t("saveTemplate.save")}
                onPress={handleSaveTemplate}
                variant="secondary"
                disabled={saved}
                accessibilityLabel={
                  saved ? t("saveTemplate.saved") : t("saveTemplate.save")
                }
              />
            )}
            <Button
              label={t("summary.returnHome")}
              onPress={handleReturnHome}
              accessibilityLabel={t("summary.returnHome")}
            />
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  flex: { flex: 1 },

  commentCard: {
    borderRadius: Radii.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radii.full,
  },
  commentInput: {
    borderRadius: Radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 80,
    textAlignVertical: "top",
    ...Typography.body,
  },
  commentFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },

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
    // No token for fontSize: 48 — larger than displayLg (28)
    fontSize: 48,
    fontWeight: "700",
    letterSpacing: -1,
    lineHeight: 56,
  },
  volumeUnit: {
    // No token — fontSize: 20 with fontWeight "600" (displaySm uses "700")
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
  muscleCardWrap: {
    borderRadius: Radii.lg,
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
    ...Typography.displaySm,
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
    // No token for fontSize: 32 — between displayLg (28) and volumeNumber (48)
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
  feedbackSection: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  feedbackRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  feedbackButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderRadius: Radii.lg,
    gap: 2,
  },
  feedbackEmoji: {
    // No token for fontSize: 18
    fontSize: 18,
  },
  preparingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderRadius: Radii.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
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
