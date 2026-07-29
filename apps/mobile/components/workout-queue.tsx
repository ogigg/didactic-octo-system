import { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { WorkoutQueueCard } from "@/components/workout-queue-card";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Opacity, Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useProfile } from "@/hooks/use-profile-query";
import type { PendingWorkout } from "@/lib/api/pending-workouts";
import { getTargetQueueCount } from "@/lib/pending-workout-queue";
import {
  useFallbackPendingWorkout,
  useRebuildQueue,
  useRetryPendingWorkout,
  useStartPendingWorkout,
} from "@/hooks/use-workout-queue";
import {
  selectNextWorkout,
  usePendingWorkoutStore,
} from "@/stores/pending-workout-store";
import { useWorkoutStore } from "@/stores/workout-store";
import { useRouter } from "expo-router";
import { getPendingWorkoutRecoveryAction } from "@/lib/pending-workout-recovery";
import { trackEvent } from "@/lib/track-event";

// -----------------------------------------------------------------------------
// WorkoutQueue
// -----------------------------------------------------------------------------

interface WorkoutQueueProps {
  queue: PendingWorkout[];
}

export function WorkoutQueue({ queue }: WorkoutQueueProps) {
  const { t } = useTranslation("home");
  const router = useRouter();

  const text = useThemeColor({}, "text");
  const textMuted = useThemeColor({}, "textMuted");
  const primary = useThemeColor({}, "primary");
  const primarySurface = useThemeColor({}, "primarySurface");

  const { data: profile } = useProfile();
  const onboardingDone = profile?.onboarding_completed ?? false;

  const isWorkoutActive = useWorkoutStore((s) => s.isActive);
  const startedAtMs = useWorkoutStore((s) => s.startedAtMs);

  const nextWorkout = selectNextWorkout(queue);
  const readyCount = queue.filter((w) => w.status === "ready").length;

  const startMutation = useStartPendingWorkout();
  const retryMutation = useRetryPendingWorkout();
  const fallbackMutation = useFallbackPendingWorkout();
  const rebuildQueue = useRebuildQueue();
  const recoveryAttempts = usePendingWorkoutStore((s) => s.recoveryAttempts);

  const handleStart = useCallback(
    (workout: PendingWorkout) => {
      startMutation.mutate({ pendingWorkout: workout });
    },
    [startMutation]
  );

  const handleRetry = useCallback(
    (workout: PendingWorkout) => {
      retryMutation.mutate(workout);
    },
    [retryMutation]
  );

  const handleFallback = useCallback(
    (workout: PendingWorkout) => {
      fallbackMutation.mutate(workout);
    },
    [fallbackMutation]
  );

  const handleSupport = useCallback(
    (workout: PendingWorkout) => {
      const reference = `GEN-${workout.id.slice(0, 8).toUpperCase()}`;
      trackEvent("activation_recovery_attempted", {
        stage: "workout_generation",
        action: "support",
        attempt_count: recoveryAttempts[workout.id] ?? 0,
        queue_position: workout.queue_position,
      });
      router.push({
        pathname: "/feedback",
        params: { recoveryReference: reference },
      } as never);
    },
    [recoveryAttempts, router]
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
      trigger: "preference_change",
    });
  }, [profile, rebuildQueue, router]);

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
          <Pressable
            onPress={handleBuildQueue}
            disabled={rebuildQueue.isPending}
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
          const recoveryAttemptCount = recoveryAttempts[workout.id] ?? 0;
          const recoveryAction = getPendingWorkoutRecoveryAction(
            workout,
            recoveryAttemptCount
          );
          const recoveryReference = `GEN-${workout.id
            .slice(0, 8)
            .toUpperCase()}`;

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
                recoveryAction === "retry"
                  ? () => handleRetry(workout)
                  : undefined
              }
              onFallback={() => handleFallback(workout)}
              onSupport={() => handleSupport(workout)}
              recoveryAction={recoveryAction}
              recoveryAttemptCount={recoveryAttemptCount}
              recoveryReference={recoveryReference}
              isRecoveryPending={
                (retryMutation.isPending &&
                  retryMutation.variables?.id === workout.id) ||
                (fallbackMutation.isPending &&
                  fallbackMutation.variables?.id === workout.id)
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
