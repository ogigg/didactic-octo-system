import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  Elevation,
  Fonts,
  Opacity,
  Radii,
  Spacing,
  Typography,
} from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import type { FocusArea, PendingWorkout } from "@/lib/api/pending-workouts";
import { getPendingWorkoutRegenerationEligibility } from "@/lib/pending-workout-regeneration";
import { useTranslation } from "react-i18next";

// -----------------------------------------------------------------------------
// Focus area display helpers
// -----------------------------------------------------------------------------

const FOCUS_LABELS: Record<FocusArea, string> = {
  push: "Push",
  pull: "Pull",
  legs: "Legs",
  upper: "Upper Body",
  lower: "Lower Body",
  full_body: "Full Body",
};

function getFocusLabel(area: FocusArea | null): string {
  return area ? FOCUS_LABELS[area] : "";
}

function getMuscleSummary(workout: PendingWorkout): string {
  if (!workout.workout_data) return "";
  const names = workout.workout_data.exercises
    .slice(0, 3)
    .map((e) => e.exercise_name);
  return names.join(", ");
}

function getExerciseCount(workout: PendingWorkout): number {
  return workout.workout_data?.exercises.length ?? 0;
}

// -----------------------------------------------------------------------------
// Skeleton Pulse (for GENERATING state)
// -----------------------------------------------------------------------------

function SkeletonPulse({
  width,
  height,
}: {
  width: number | string;
  height: number;
}) {
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(0.4);
  const fillColor = useThemeColor({}, "border");

  useEffect(() => {
    if (reducedMotion) return;
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800 }),
        withTiming(0.4, { duration: 800 })
      ),
      -1,
      false
    );
  }, [reducedMotion, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width: width as number,
          height,
          borderRadius: Radii.sm,
          backgroundColor: fillColor,
        },
        animatedStyle,
      ]}
    />
  );
}

// -----------------------------------------------------------------------------
// Elapsed Timer
// -----------------------------------------------------------------------------

function ElapsedTimer({ startedAtMs }: { startedAtMs: number }) {
  const success = useThemeColor({}, "success");

  const elapsed = Date.now() - startedAtMs;
  const totalSeconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const display = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return (
    <View style={cardStyles.liveRow}>
      <View style={[cardStyles.liveDot, { backgroundColor: success }]} />
      <Text style={[cardStyles.timerText, { color: success }]}>{display}</Text>
    </View>
  );
}

// -----------------------------------------------------------------------------
// WorkoutQueueCard
// -----------------------------------------------------------------------------

interface WorkoutQueueCardProps {
  workout: PendingWorkout;
  isNextUp: boolean;
  isActive?: boolean;
  activeStartedAtMs?: number | null;
  onPress?: () => void;
  onStart?: () => void;
  onResume?: () => void;
  onRetry?: () => void;
}

export function WorkoutQueueCard({
  workout,
  isNextUp,
  isActive = false,
  activeStartedAtMs,
  onPress,
  onStart,
  onResume,
  onRetry,
}: WorkoutQueueCardProps) {
  const { t } = useTranslation("home");

  const text = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const textDisabled = useThemeColor({}, "textDisabled");
  const primary = useThemeColor({}, "primary");
  const primarySurface = useThemeColor({}, "primarySurface");
  const primaryContainer = useThemeColor({}, "primaryContainer");
  const backgroundElevated = useThemeColor({}, "backgroundElevated");
  const backgroundSubtle = useThemeColor({}, "backgroundSubtle");
  const border = useThemeColor({}, "border");
  const success = useThemeColor({}, "success");
  const error = useThemeColor({}, "error");
  const destructiveSurface = useThemeColor({}, "destructiveSurface");

  const focusLabel = getFocusLabel(workout.focus_area);
  const exerciseCount = getExerciseCount(workout);
  const regenerationEligibility = getPendingWorkoutRegenerationEligibility(
    workout.last_regenerated_at
  );

  // -- ACTIVE state --
  if (isActive) {
    return (
      <Pressable
        onPress={onResume}
        style={({ pressed }) => [
          cardStyles.container,
          {
            backgroundColor: backgroundElevated,
            borderColor: success,
            borderWidth: 1.5,
          },
          Elevation.sm,
          { opacity: pressed ? Opacity.pressed : 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={t("queueCard.resumeWorkout")}
      >
        <View style={cardStyles.headerRow}>
          <Text style={[Typography.label, { color: success }]}>
            IN PROGRESS
          </Text>
          {activeStartedAtMs && (
            <ElapsedTimer startedAtMs={activeStartedAtMs} />
          )}
        </View>
        <Text
          style={[Typography.titleMd, { color: text }, cardStyles.title]}
          numberOfLines={1}
        >
          {workout.workout_data?.workout_name ??
            t("queueCard.dayLabel", { position: workout.queue_position })}
        </Text>
        {focusLabel ? (
          <View style={cardStyles.chipRow}>
            <View
              style={[cardStyles.chip, { backgroundColor: primarySurface }]}
            >
              <Text style={[Typography.caption, { color: primary }]}>
                {focusLabel}
              </Text>
            </View>
          </View>
        ) : null}
        <View style={[cardStyles.ctaButton, { backgroundColor: success }]}>
          <Text style={[Typography.titleSm, cardStyles.ctaText]}>
            {t("queueCard.resumeWorkout")}
          </Text>
        </View>
      </Pressable>
    );
  }

  // -- GENERATING state --
  if (workout.status === "generating") {
    return (
      <View
        style={[
          cardStyles.container,
          {
            backgroundColor: backgroundSubtle,
            borderColor: border,
            borderWidth: 1,
          },
        ]}
      >
        <View style={cardStyles.headerRow}>
          <Text style={[Typography.label, { color: textMuted }]}>
            {t("queueCard.dayLabel", { position: workout.queue_position })}
          </Text>
        </View>
        <View style={cardStyles.skeletonGroup}>
          <SkeletonPulse width="60%" height={14} />
          <SkeletonPulse width="40%" height={10} />
          <View style={{ height: Spacing.sm }} />
          <SkeletonPulse width="80%" height={10} />
          <SkeletonPulse width="55%" height={10} />
        </View>
        <Text
          style={[
            Typography.caption,
            { color: textMuted },
            cardStyles.generatingText,
          ]}
        >
          {t("queueCard.generating")}
        </Text>
      </View>
    );
  }

  // -- REGENERATING state --
  if (workout.status === "regenerating" && workout.workout_data) {
    const muscleSummary = getMuscleSummary(workout);

    if (isNextUp) {
      const exercises = workout.workout_data.exercises;
      const previewExercises = exercises.slice(0, 3);
      const remaining = exercises.length - previewExercises.length;

      return (
        <View
          style={[
            cardStyles.container,
            {
              backgroundColor: backgroundElevated,
              borderColor: border,
              borderWidth: 1,
              opacity: 0.92,
            },
            Elevation.sm,
          ]}
          accessibilityLabel={t("queueCard.regenerating")}
        >
          <View style={cardStyles.headerRow}>
            <View
              style={[
                cardStyles.nextBadge,
                { backgroundColor: primaryContainer, gap: Spacing.sm },
              ]}
            >
              <View
                style={[cardStyles.liveDot, { backgroundColor: primary }]}
              />
              <Text style={[Typography.label, { color: primary }]}>
                {t("queueCard.regenerating")}
              </Text>
            </View>
            {focusLabel ? (
              <Text style={[Typography.caption, { color: textSecondary }]}>
                {focusLabel}
              </Text>
            ) : null}
          </View>

          <Text
            style={[Typography.titleMd, { color: text }, cardStyles.title]}
            numberOfLines={1}
          >
            {workout.workout_data.workout_name}
          </Text>

          <Text
            style={[
              Typography.caption,
              { color: textMuted },
              cardStyles.statusMessage,
            ]}
          >
            {t("queueCard.regeneratingSubtitle")}
          </Text>

          <View style={cardStyles.metaRow}>
            <View style={cardStyles.metaItem}>
              <IconSymbol name="clock" size={13} color={textMuted} />
              <Text style={[Typography.caption, { color: textSecondary }]}>
                {t("queueCard.duration", {
                  minutes: Math.round(exerciseCount * 7),
                })}
              </Text>
            </View>
            <View style={cardStyles.metaItem}>
              <IconSymbol name="dumbbell.fill" size={13} color={textMuted} />
              <Text style={[Typography.caption, { color: textSecondary }]}>
                {exerciseCount} exercises
              </Text>
            </View>
          </View>

          <View
            style={[cardStyles.exercisePreview, { borderTopColor: border }]}
          >
            {previewExercises.map((ex) => (
              <View key={ex.exercise_id} style={cardStyles.exerciseRow}>
                <Text
                  style={[Typography.bodyMedium, { color: text }]}
                  numberOfLines={1}
                >
                  {ex.exercise_name}
                </Text>
                <Text style={[Typography.caption, { color: textSecondary }]}>
                  {t("queueCard.setsAndReps", {
                    sets: ex.sets.length,
                    reps: ex.sets[0]?.target_reps ?? "—",
                  })}
                </Text>
              </View>
            ))}
            {remaining > 0 && (
              <Text
                style={[
                  Typography.caption,
                  { color: textMuted },
                  cardStyles.moreText,
                ]}
              >
                {t("queueCard.exerciseCount", { count: remaining })}
              </Text>
            )}
          </View>

          <View
            style={[
              cardStyles.statusRail,
              { backgroundColor: primaryContainer, borderColor: border },
            ]}
          >
            <Text style={[Typography.titleSm, { color: primary }]}>
              {t("queueCard.regenerating")}
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View
        style={[
          cardStyles.container,
          cardStyles.containerCompact,
          {
            backgroundColor: backgroundElevated,
            borderColor: border,
            borderWidth: 1,
            opacity: 0.92,
          },
        ]}
        accessibilityLabel={t("queueCard.regenerating")}
      >
        <View style={cardStyles.collapsedRow}>
          <View style={cardStyles.collapsedLeft}>
            <Text style={[Typography.label, { color: textMuted }]}>
              {t("queueCard.dayLabel", { position: workout.queue_position })}
            </Text>
            <Text
              style={[Typography.titleSm, { color: text }]}
              numberOfLines={1}
            >
              {workout.workout_data.workout_name}
            </Text>
            <Text
              style={[Typography.caption, { color: textSecondary }]}
              numberOfLines={1}
            >
              {muscleSummary}
            </Text>
            <Text style={[Typography.caption, { color: primary }]}>
              {t("queueCard.regeneratingSubtitle")}
            </Text>
          </View>
          <View style={cardStyles.collapsedRight}>
            {focusLabel ? (
              <View
                style={[cardStyles.chip, { backgroundColor: primaryContainer }]}
              >
                <Text style={[Typography.micro, { color: primary }]}>
                  {focusLabel}
                </Text>
              </View>
            ) : null}
            <View
              style={[
                cardStyles.liveDot,
                { backgroundColor: primary, marginRight: Spacing.xs },
              ]}
            />
          </View>
        </View>
      </View>
    );
  }

  // -- QUEUED state --
  if (workout.status === "queued") {
    return (
      <View
        style={[
          cardStyles.container,
          cardStyles.containerCompact,
          {
            backgroundColor: backgroundSubtle,
            borderColor: border,
            borderWidth: 1,
          },
        ]}
      >
        <View style={cardStyles.headerRow}>
          <Text style={[Typography.label, { color: textDisabled }]}>
            {t("queueCard.dayLabel", { position: workout.queue_position })}
          </Text>
        </View>
        <Text style={[Typography.body, { color: textMuted }]}>
          {t("queueCard.queued")}
        </Text>
      </View>
    );
  }

  // -- FAILED state --
  if (workout.status === "failed") {
    return (
      <View
        style={[
          cardStyles.container,
          {
            backgroundColor: destructiveSurface,
            borderColor: error,
            borderWidth: 1,
          },
        ]}
      >
        <View style={cardStyles.headerRow}>
          <Text style={[Typography.label, { color: error }]}>
            {t("queueCard.dayLabel", { position: workout.queue_position })}
          </Text>
        </View>
        <Text style={[Typography.bodyMedium, { color: error }]}>
          {t("queueCard.failed")}
        </Text>
        {onRetry && (
          <Pressable
            onPress={onRetry}
            style={({ pressed }) => [
              cardStyles.retryButton,
              { borderColor: error, opacity: pressed ? Opacity.pressed : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("queueCard.tryAgain")}
          >
            <Text style={[Typography.titleSm, { color: error }]}>
              {t("queueCard.tryAgain")}
            </Text>
          </Pressable>
        )}
      </View>
    );
  }

  // -- READY state (next-up hero card) --
  if (isNextUp && workout.status === "ready" && workout.workout_data) {
    const exercises = workout.workout_data.exercises;
    const previewExercises = exercises.slice(0, 3);
    const remaining = exercises.length - previewExercises.length;

    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          cardStyles.container,
          {
            backgroundColor: backgroundElevated,
            borderColor: primary,
            borderWidth: 1.5,
          },
          Elevation.sm,
          { opacity: pressed ? Opacity.pressed : 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${workout.workout_data.workout_name}, ${exerciseCount} exercises`}
      >
        {/* Header */}
        <View style={cardStyles.headerRow}>
          <View
            style={[cardStyles.nextBadge, { backgroundColor: primarySurface }]}
          >
            <IconSymbol name="flame.fill" size={12} color={primary} />
            <Text style={[Typography.label, { color: primary }]}>NEXT UP</Text>
          </View>
          {focusLabel ? (
            <Text style={[Typography.caption, { color: textSecondary }]}>
              {focusLabel}
            </Text>
          ) : null}
        </View>

        {/* Title */}
        <Text
          style={[Typography.titleMd, { color: text }, cardStyles.title]}
          numberOfLines={1}
        >
          {workout.workout_data.workout_name}
        </Text>

        {!regenerationEligibility.canRegenerate && (
          <Text
            style={[
              Typography.caption,
              { color: textMuted },
              cardStyles.statusMessage,
            ]}
          >
            {t("queueCard.regenerationUnavailableToday")}
          </Text>
        )}

        {/* Meta row: duration + exercise count */}
        <View style={cardStyles.metaRow}>
          <View style={cardStyles.metaItem}>
            <IconSymbol name="clock" size={13} color={textMuted} />
            <Text style={[Typography.caption, { color: textSecondary }]}>
              {t("queueCard.duration", {
                minutes: Math.round(exerciseCount * 7),
              })}
            </Text>
          </View>
          <View style={cardStyles.metaItem}>
            <IconSymbol name="dumbbell.fill" size={13} color={textMuted} />
            <Text style={[Typography.caption, { color: textSecondary }]}>
              {exerciseCount} exercises
            </Text>
          </View>
        </View>

        {/* Exercise preview list */}
        <View style={[cardStyles.exercisePreview, { borderTopColor: border }]}>
          {previewExercises.map((ex) => (
            <View key={ex.exercise_id} style={cardStyles.exerciseRow}>
              <Text
                style={[Typography.bodyMedium, { color: text }]}
                numberOfLines={1}
              >
                {ex.exercise_name}
              </Text>
              <Text style={[Typography.caption, { color: textSecondary }]}>
                {t("queueCard.setsAndReps", {
                  sets: ex.sets.length,
                  reps: ex.sets[0]?.target_reps ?? "—",
                })}
              </Text>
            </View>
          ))}
          {remaining > 0 && (
            <Text
              style={[
                Typography.caption,
                { color: textMuted },
                cardStyles.moreText,
              ]}
            >
              {t("queueCard.exerciseCount", { count: remaining })}
            </Text>
          )}
        </View>

        {/* Start CTA */}
        {onStart && (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onStart();
            }}
            style={({ pressed }) => [
              cardStyles.ctaButton,
              {
                backgroundColor: primary,
                opacity: pressed ? Opacity.pressed : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("queueCard.startWorkout")}
          >
            <Text style={[Typography.titleSm, cardStyles.ctaText]}>
              {t("queueCard.startWorkout")}
            </Text>
          </Pressable>
        )}
      </Pressable>
    );
  }

  // -- READY state (future/collapsed) --
  if (workout.status === "ready" && workout.workout_data) {
    const muscleSummary = getMuscleSummary(workout);

    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          cardStyles.container,
          cardStyles.containerCompact,
          {
            backgroundColor: backgroundElevated,
            borderColor: border,
            borderWidth: 1,
          },
          { opacity: pressed ? Opacity.pressed : 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${workout.workout_data.workout_name}, ${exerciseCount} exercises`}
      >
        <View style={cardStyles.collapsedRow}>
          <View style={cardStyles.collapsedLeft}>
            <Text style={[Typography.label, { color: textMuted }]}>
              {t("queueCard.dayLabel", { position: workout.queue_position })}
            </Text>
            <Text
              style={[Typography.titleSm, { color: text }]}
              numberOfLines={1}
            >
              {workout.workout_data.workout_name}
            </Text>
            <Text
              style={[Typography.caption, { color: textSecondary }]}
              numberOfLines={1}
            >
              {muscleSummary}
            </Text>
            {!regenerationEligibility.canRegenerate && (
              <Text style={[Typography.caption, { color: textMuted }]}>
                {t("queueCard.regenerationUnavailableToday")}
              </Text>
            )}
          </View>
          <View style={cardStyles.collapsedRight}>
            {focusLabel ? (
              <View
                style={[cardStyles.chip, { backgroundColor: primarySurface }]}
              >
                <Text style={[Typography.micro, { color: primary }]}>
                  {focusLabel}
                </Text>
              </View>
            ) : null}
            <IconSymbol name="chevron.right" size={16} color={textMuted} />
          </View>
        </View>
      </Pressable>
    );
  }

  // Fallback for edge cases (e.g., ready but no workout_data)
  return null;
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const cardStyles = StyleSheet.create({
  container: {
    borderRadius: Radii.md,
    padding: Spacing.xl,
  },
  containerCompact: {
    padding: Spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  nextBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radii.full,
  },
  title: {
    marginBottom: Spacing.sm,
  },
  metaRow: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginBottom: Spacing.md,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  chipRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  chip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radii.full,
  },
  exercisePreview: {
    borderTopWidth: 1,
    paddingTop: Spacing.md,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  exerciseRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  moreText: {
    marginTop: Spacing.xs,
  },
  statusMessage: {
    marginBottom: Spacing.md,
  },
  ctaButton: {
    borderRadius: Radii.lg,
    paddingVertical: 13,
    alignItems: "center",
  },
  statusRail: {
    borderRadius: Radii.lg,
    borderWidth: 1,
    paddingVertical: 13,
    alignItems: "center",
  },
  ctaText: {
    color: "#FFFFFF",
  },
  retryButton: {
    borderWidth: 1,
    borderRadius: Radii.lg,
    paddingVertical: Spacing.md,
    alignItems: "center",
    marginTop: Spacing.md,
  },
  collapsedRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  collapsedLeft: {
    flex: 1,
    gap: 2,
  },
  collapsedRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  liveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: Radii.full,
  },
  timerText: {
    ...Typography.caption,
    fontFamily: Fonts?.mono,
    fontVariant: ["tabular-nums"],
    fontWeight: "600",
  },
  skeletonGroup: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  generatingText: {
    marginTop: Spacing.xs,
  },
});
