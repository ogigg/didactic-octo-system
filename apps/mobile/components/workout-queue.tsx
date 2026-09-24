import { useCallback, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";

import { WorkoutQueueCard } from "@/components/workout-queue-card";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Opacity, Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useProfile } from "@/hooks/use-profile-query";
import type { PendingWorkout } from "@/lib/api/pending-workouts";
import { getTargetQueueCount } from "@/lib/pending-workout-queue";
import {
  useRebuildQueue,
  useRegenerateWorkout,
  useStartPendingWorkout,
} from "@/hooks/use-workout-queue";
import { selectNextWorkout } from "@/stores/pending-workout-store";
import { useWorkoutStore } from "@/stores/workout-store";
import { useRouter } from "expo-router";

// -----------------------------------------------------------------------------
// WorkoutQueue
// -----------------------------------------------------------------------------

interface WorkoutQueueProps {
  queue: PendingWorkout[];
  isLoading: boolean;
}

export function WorkoutQueue({ queue, isLoading }: WorkoutQueueProps) {
  const { t } = useTranslation("home");
  const router = useRouter();

  const text = useThemeColor({}, "text");
  const textMuted = useThemeColor({}, "textMuted");
  const primary = useThemeColor({}, "primary");
  const primarySurface = useThemeColor({}, "primarySurface");

  const { data: profile } = useProfile();
  const attemptedInitial = useRef<string | null>(null);
  const onboardingDone = profile?.onboarding_completed ?? false;

  const isWorkoutActive = useWorkoutStore((s) => s.isActive);
  const startedAtMs = useWorkoutStore((s) => s.startedAtMs);

  const nextWorkout = selectNextWorkout(queue);
  const readyCount = queue.filter((w) => w.status === "ready").length;

  const startMutation = useStartPendingWorkout();
  const regenerateMutation = useRegenerateWorkout();
  const rebuildQueue = useRebuildQueue();

  const handleStart = useCallback(
    (workout: PendingWorkout) => {
      startMutation.mutate({ pendingWorkout: workout });
    },
    [startMutation]
  );

  const handleRetry = useCallback(
    (workout: PendingWorkout) => {
      regenerateMutation.mutate({ pendingWorkout: workout });
    },
    [regenerateMutation]
  );

  const handlePress = useCallback(
    (workout: PendingWorkout) => {
      if (workout.status === "ready") {
        router.push(`/workout-preview?id=${workout.id}` as never);
      }
    },
    [router]
  );

  const handleResume = useCallback(() => {
    router.push("/workout");
  }, [router]);

  const handleBuildQueue = useCallback(() => {
    if (
      !profile?.training_split ||
      !profile.session_duration_minutes ||
      !profile.equipment_level ||
      !profile.training_style ||
      !profile.difficulty_level
    ) {
      router.push("/training-preferences" as never);
      return;
    }

    rebuildQueue.mutate({
      count: getTargetQueueCount(profile.weekly_frequency),
      preferences: {
        training_split: profile.training_split,
        session_duration_minutes: profile.session_duration_minutes as
          | 15
          | 30
          | 45
          | 60
          | 90,
        equipment: profile.equipment_level,
        training_style: profile.training_style,
        difficulty: profile.difficulty_level,
        custom_prompt: profile.training_custom_prompt,
      },
      baselines: [],
      trigger: profile.initial_queue_generated_at
        ? "preference_change"
        : "onboarding",
    });
  }, [profile, rebuildQueue, router]);

  const serverPreparing =
    !!profile?.queue_generation_request_id &&
    !!profile.queue_generation_started_at &&
    Date.now() - Date.parse(profile.queue_generation_started_at) <
      15 * 60 * 1000;
  const preparing = rebuildQueue.isPending || serverPreparing;
  useEffect(() => {
    if (
      !profile?.id ||
      !onboardingDone ||
      profile.initial_queue_generated_at ||
      serverPreparing ||
      attemptedInitial.current === profile.id
    )
      return;
    attemptedInitial.current = profile.id;
    handleBuildQueue();
  }, [profile, onboardingDone, serverPreparing, handleBuildQueue]);

  if (isLoading || (preparing && queue.length === 0)) {
    return (
      <View style={styles.container}>
        <Text style={[Typography.titleMd, { color: text }]}>
          {t("workoutQueue.title")}
        </Text>
        <View
          style={styles.loadingContainer}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={t("workoutQueue.loading")}
          accessibilityState={{ busy: true }}
        >
          <ActivityIndicator color={primary} />
          <Text style={[Typography.body, { color: textMuted }]}>
            {t("workoutQueue.loading")}
          </Text>
        </View>
      </View>
    );
  }

  if (queue.length === 0) {
    if (onboardingDone) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={[Typography.body, { color: textMuted }]}>
            {t("workoutQueue.emptyReady")}
          </Text>
          <Text style={[Typography.caption, { color: textMuted }]}>
            {t("workoutQueue.emptyReadySubtitle")}
          </Text>
          {rebuildQueue.isError && (
            <Text
              accessibilityRole="alert"
              style={[Typography.caption, { color: text }]}
            >
              {t("workoutQueue.preparationError")}
            </Text>
          )}
          <Pressable
            onPress={handleBuildQueue}
            disabled={preparing}
            style={({ pressed }) => [
              styles.generateButton,
              {
                backgroundColor: primarySurface,
                opacity:
                  pressed || rebuildQueue.isPending ? Opacity.pressed : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("workoutQueue.generate")}
          >
            <IconSymbol name="flame.fill" size={16} color={primary} />
            <Text style={[Typography.titleSm, { color: primary }]}>
              {t("workoutQueue.generate")}
            </Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={[Typography.body, { color: textMuted }]}>
          {t("workoutQueue.empty")}
        </Text>
        <Text style={[Typography.caption, { color: textMuted }]}>
          {t("workoutQueue.emptySubtitle")}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {preparing && (
        <Text
          accessibilityLiveRegion="polite"
          style={[Typography.body, { color: textMuted }]}
        >
          {t("workoutQueue.preparing")}
        </Text>
      )}
      {rebuildQueue.isError && (
        <>
          <Text
            accessibilityRole="alert"
            style={[Typography.body, { color: text }]}
          >
            {t("workoutQueue.preparationError")}
          </Text>
          <Pressable onPress={handleBuildQueue} accessibilityRole="button">
            <Text style={[Typography.body, { color: primary }]}>
              {t("workoutQueue.retryPreparation")}
            </Text>
          </Pressable>
        </>
      )}
      {/* Section header */}
      <View style={styles.headerRow}>
        <Text style={[Typography.titleMd, { color: text }]}>
          {t("workoutQueue.title")}
        </Text>
        <Text style={[Typography.titleSm, { color: primary }]}>
          {t("workoutQueue.readyCount", {
            ready: readyCount,
            total: queue.length,
          })}
        </Text>
      </View>

      {/* Queue cards */}
      <View style={styles.cardList}>
        {queue.map((workout) => {
          const isNextUp = !isWorkoutActive && nextWorkout?.id === workout.id;

          return (
            <WorkoutQueueCard
              key={workout.id}
              workout={workout}
              isNextUp={isNextUp}
              isActive={
                isWorkoutActive && workout.status === "ready" && isNextUp
              }
              activeStartedAtMs={isWorkoutActive ? startedAtMs : null}
              onPress={() => handlePress(workout)}
              onStart={() => handleStart(workout)}
              onResume={handleResume}
              onRetry={
                workout.status === "failed"
                  ? () => handleRetry(workout)
                  : undefined
              }
            />
          );
        })}
      </View>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardList: {
    gap: Spacing.md,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
    gap: Spacing.sm,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
    gap: Spacing.sm,
  },
  generateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radii.full,
    marginTop: Spacing.md,
  },
});
