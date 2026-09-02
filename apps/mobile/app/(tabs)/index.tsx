import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";

import { AmbientGlow } from "@/components/ambient-glow";
import { WorkoutQueue } from "@/components/workout-queue";
import { UsageIndicator } from "@/components/subscription/usage-indicator";
import { Paywall } from "@/components/subscription/paywall";
import { StreakProtectionSheet } from "@/components/streak/streak-protection-sheet";
import { WorkoutTemplateCard } from "@/components/workout-template-card";
import { WorkoutPlanCard } from "@/components/workout-plan-card";
import { GradientSurface } from "@/components/ui/gradient-surface";
import { SectionHeader } from "@/components/ui/section-header";
import { TabScreen } from "@/components/ui/tab-screen";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useTabBarClearance } from "@/hooks/use-tab-bar-clearance";
import {
  useStartPendingWorkout,
  useWorkoutQueue,
} from "@/hooks/use-workout-queue";
import {
  useApplyStreakProtection,
  useDismissStreakPrompt,
  useRecordComebackEvent,
  useRestartStreak,
  useStreakStatus,
} from "@/hooks/use-streak-protection";
import { useProfile } from "@/hooks/use-profile-query";
import { useLocalizedExerciseMap } from "@/hooks/use-exercises-query";
import { getTargetQueueCount } from "@/lib/pending-workout-queue";
import {
  fetchPreviousSetDisplays,
  fetchWorkoutHistoryForDayRange,
} from "@/lib/api/workouts";
import { buildTemplateWorkoutExercises } from "@/lib/start-template-workout";
import { getMondayLocal } from "@/lib/iso-week";
import { selectNextWorkout } from "@/stores/pending-workout-store";
import { useWorkoutStore } from "@/stores/workout-store";
import { useWorkoutTemplatesStore } from "@/stores/workout-templates-store";
import type { WorkoutTemplate } from "@/stores/workout-templates-store";
import { trackEvent, type EventPayload } from "@/lib/track-event";
import type { StreakStatus } from "@/lib/api/streak-protection";
import { markComebackWorkoutStarted } from "@/lib/comeback-workout";
import type { WeightUnit } from "@/lib/unit-conversion";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function getGreetingKey():
  | "greeting.morning"
  | "greeting.afternoon"
  | "greeting.evening" {
  const hour = new Date().getHours();
  if (hour < 12) return "greeting.morning";
  if (hour < 18) return "greeting.afternoon";
  return "greeting.evening";
}

function streakAnalyticsPayload(status: StreakStatus): EventPayload {
  return {
    tier: status.tier,
    is_pro_active: status.is_pro_active,
    streak_weeks: status.current_streak_weeks,
    missed_weeks: status.missed_week_count,
    days_since_last_workout: status.days_since_last_workout,
    prompt_state: status.prompt_state,
    pro_freezes_available: status.pro_freezes_available,
    earned_freezes_available: status.earned_freezes_available,
    lifetime_rescue_available: status.lifetime_rescue_available,
    auto_apply_enabled: status.auto_apply_enabled,
  };
}

// -----------------------------------------------------------------------------
// HomeScreen
// -----------------------------------------------------------------------------

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useTranslation("home");
  const { t: tStreak } = useTranslation("streakProtection");

  // Data
  const { data: profile } = useProfile();
  const { isLoading: isQueueLoading, refetch, queue } = useWorkoutQueue();
  const streakStatusQuery = useStreakStatus();
  const applyStreakProtection = useApplyStreakProtection();
  const dismissStreakPrompt = useDismissStreakPrompt();
  const restartStreak = useRestartStreak();
  const recordComebackEvent = useRecordComebackEvent();
  const startPendingWorkout = useStartPendingWorkout();
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const [locallyHiddenPromptState, setLocallyHiddenPromptState] = useState<
    string | null
  >(null);
  const shownPromptRef = useRef<string | null>(null);
  const earnedFreezeTrackedRef = useRef(false);
  const handleRefresh = useCallback(async () => {
    setIsManualRefreshing(true);
    await refetch();
    setIsManualRefreshing(false);
  }, [refetch]);
  const frequency = useMemo(() => {
    return getTargetQueueCount(profile?.weekly_frequency);
  }, [profile?.weekly_frequency]);
  const weekStart = useMemo(() => getMondayLocal(new Date()), []);
  const completedWorkoutsQuery = useQuery({
    queryKey: ["workouts", "completed-week", weekStart.toISOString()],
    queryFn: () =>
      fetchWorkoutHistoryForDayRange(
        weekStart.toISOString(),
        new Date().toISOString()
      ),
    staleTime: 60_000,
  });

  // Active workout state
  const isWorkoutActive = useWorkoutStore((s) => s.isActive);
  const workoutName = useWorkoutStore((s) => s.workoutName);
  const workoutExercises = useWorkoutStore((s) => s.exercises);
  const startedAtMs = useWorkoutStore((s) => s.startedAtMs);
  const startWorkout = useWorkoutStore((s) => s.startWorkout);

  // Templates
  const templates = useWorkoutTemplatesStore((s) => s.templates);
  const templateExerciseIds = useMemo(
    () =>
      templates.flatMap((template) => template.exercises.map((ex) => ex.id)),
    [templates]
  );
  const workoutExerciseIds = useMemo(
    () => [
      ...workoutExercises.map((exercise) => exercise.id),
      ...templateExerciseIds,
    ],
    [templateExerciseIds, workoutExercises]
  );
  const { exerciseMap } = useLocalizedExerciseMap(workoutExerciseIds);

  // Weekly progress comes from completed sessions, not queue size.
  const completedCount = Math.min(
    frequency,
    completedWorkoutsQuery.data?.length ?? 0
  );
  const progressSegmentIds = useMemo(
    () => Array.from({ length: frequency }, (_, index) => `week-${index + 1}`),
    [frequency]
  );
  const nextQueuedWorkout = useMemo(() => selectNextWorkout(queue), [queue]);
  const streakStatus = streakStatusQuery.data;
  const shouldShowStreakSheet =
    !!streakStatus &&
    streakStatus.should_show_prompt &&
    streakStatus.prompt_state !== "none" &&
    locallyHiddenPromptState !== streakStatus.prompt_state;
  const isStreakActionPending =
    applyStreakProtection.isPending ||
    dismissStreakPrompt.isPending ||
    restartStreak.isPending ||
    recordComebackEvent.isPending ||
    startPendingWorkout.isPending;

  // Colors
  const primary = useThemeColor({}, "primary");
  const tabBarClearance = useTabBarClearance();
  const border = useThemeColor({}, "border");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");

  // Handlers
  const handleCreateWorkout = useCallback(() => {
    if (!isWorkoutActive) {
      startWorkout(t("myWorkouts.newWorkoutName"), [], undefined, null, {
        workoutSource: "manual",
      });
    }
    router.push("/workout");
  }, [isWorkoutActive, startWorkout, t, router]);

  const handleStartTemplate = useCallback(
    async (template: WorkoutTemplate) => {
      if (!isWorkoutActive) {
        const weightUnit: WeightUnit =
          (profile?.weight_unit as WeightUnit) ?? "kg";
        const previousById = await fetchPreviousSetDisplays(
          template.exercises.map((ex) => ex.id),
          weightUnit
        ).catch(() => ({}));

        const exercises = buildTemplateWorkoutExercises(template.exercises, {
          resolveName: (id, fallback) => exerciseMap.get(id)?.name ?? fallback,
          previousById,
        });
        startWorkout(template.name, exercises, undefined, null, {
          workoutSource: "template",
          workoutId: template.id,
        });
      }
      router.push("/workout");
    },
    [exerciseMap, isWorkoutActive, profile?.weight_unit, startWorkout, router]
  );

  const handleResumeWorkout = useCallback(() => {
    router.push("/workout");
  }, [router]);

  const handleStreakError = useCallback(
    (error: unknown) => {
      console.warn("Streak protection action failed:", error);
      Alert.alert(tStreak("errors.title"), tStreak("errors.message"));
    },
    [tStreak]
  );

  const handleDismissStreakPrompt = useCallback(() => {
    if (!streakStatus) return;

    setLocallyHiddenPromptState(streakStatus.prompt_state);
    trackEvent("streak_prompt_dismissed", streakAnalyticsPayload(streakStatus));
    dismissStreakPrompt.mutate(streakStatus.prompt_state, {
      onError: handleStreakError,
    });
  }, [dismissStreakPrompt, handleStreakError, streakStatus]);

  const handleApplyStreakProtection = useCallback(
    (type: "lifetime_rescue" | "earned_freeze" | "pro_freeze") => {
      if (!streakStatus) return;

      applyStreakProtection.mutate(type, {
        onSuccess: () => {
          setLocallyHiddenPromptState(streakStatus.prompt_state);
          trackEvent("streak_protection_applied", {
            ...streakAnalyticsPayload(streakStatus),
            protection_type: type,
          });

          if (type === "lifetime_rescue") {
            trackEvent(
              "streak_lifetime_rescue_used",
              streakAnalyticsPayload(streakStatus)
            );
          }
        },
        onError: handleStreakError,
      });
    },
    [applyStreakProtection, handleStreakError, streakStatus]
  );

  const handleStartComeback = useCallback(() => {
    if (!streakStatus) return;

    setLocallyHiddenPromptState(streakStatus.prompt_state);
    trackEvent(
      "comeback_workout_started",
      streakAnalyticsPayload(streakStatus)
    );
    markComebackWorkoutStarted({
      promptState: streakStatus.prompt_state,
      startedAtMs: Date.now(),
      hadReadyWorkout: nextQueuedWorkout != null,
    }).catch(console.warn);
    dismissStreakPrompt.mutate(streakStatus.prompt_state, {
      onError: handleStreakError,
    });
    recordComebackEvent.mutate(
      {
        eventType: "comeback_started",
        metadata: {
          prompt_state: streakStatus.prompt_state,
          has_ready_workout: nextQueuedWorkout != null,
        },
      },
      { onError: handleStreakError }
    );

    if (isWorkoutActive) {
      router.push("/workout");
      return;
    }

    if (nextQueuedWorkout) {
      startPendingWorkout.mutate({
        pendingWorkout: nextQueuedWorkout,
        workoutSource: "comeback",
      });
      return;
    }

    router.push("/training-preferences" as never);
  }, [
    dismissStreakPrompt,
    handleStreakError,
    isWorkoutActive,
    nextQueuedWorkout,
    recordComebackEvent,
    router,
    startPendingWorkout,
    streakStatus,
  ]);

  const handleAdjustPlan = useCallback(() => {
    if (streakStatus) {
      setLocallyHiddenPromptState(streakStatus.prompt_state);
      dismissStreakPrompt.mutate(streakStatus.prompt_state, {
        onError: handleStreakError,
      });
    }

    router.push("/training-preferences" as never);
  }, [dismissStreakPrompt, handleStreakError, router, streakStatus]);

  const handleUpgradeFromStreak = useCallback(() => {
    if (!streakStatus) return;

    setLocallyHiddenPromptState(streakStatus.prompt_state);
    trackEvent("streak_upgrade_tapped", streakAnalyticsPayload(streakStatus));
    dismissStreakPrompt.mutate(streakStatus.prompt_state, {
      onError: handleStreakError,
    });
    router.push("/subscription" as never);
  }, [dismissStreakPrompt, handleStreakError, router, streakStatus]);

  const handleRestartStreak = useCallback(() => {
    if (!streakStatus) return;

    restartStreak.mutate(undefined, {
      onSuccess: () => {
        setLocallyHiddenPromptState(streakStatus.prompt_state);
        trackEvent("streak_restarted", streakAnalyticsPayload(streakStatus));
      },
      onError: handleStreakError,
    });
  }, [handleStreakError, restartStreak, streakStatus]);

  const activeExercises = useMemo(
    () =>
      workoutExercises.map((ex) => ({
        name: exerciseMap.get(ex.id)?.name ?? ex.name,
        muscleGroup: "",
        sets: ex.sets.length,
        reps: ex.sets[0] ? `${ex.sets[0].reps || "—"}` : "—",
      })),
    [exerciseMap, workoutExercises]
  );

  const greeting = useMemo(() => t(getGreetingKey()), [t]);

  useFocusEffect(
    useCallback(() => {
      trackEvent("queue_state_on_open", {
        ready_count: queue.filter((workout) => workout.status === "ready")
          .length,
        generating_count: queue.filter(
          (workout) =>
            workout.status === "generating" ||
            workout.status === "queued" ||
            workout.status === "regenerating"
        ).length,
        failed_count: queue.filter((workout) => workout.status === "failed")
          .length,
        total_count: queue.length,
        has_active_workout: isWorkoutActive,
      });
    }, [isWorkoutActive, queue])
  );

  useEffect(() => {
    if (!streakStatus) return;

    trackEvent("streak_status_viewed", streakAnalyticsPayload(streakStatus));
  }, [streakStatus]);

  useEffect(() => {
    if (!streakStatus || !shouldShowStreakSheet) return;

    if (shownPromptRef.current === streakStatus.prompt_state) {
      return;
    }

    shownPromptRef.current = streakStatus.prompt_state;
    trackEvent("streak_prompt_shown", streakAnalyticsPayload(streakStatus));

    if (
      streakStatus.prompt_state === "free_earned_freeze" &&
      streakStatus.earned_freezes_available > 0 &&
      !earnedFreezeTrackedRef.current
    ) {
      earnedFreezeTrackedRef.current = true;
      trackEvent("streak_freeze_earned", streakAnalyticsPayload(streakStatus));
    }
  }, [shouldShowStreakSheet, streakStatus]);

  return (
    <TabScreen>
      <AmbientGlow variant="hero" />
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: tabBarClearance },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isManualRefreshing}
              onRefresh={handleRefresh}
            />
          }
        >
          {/* Greeting */}
          <View style={styles.greetingSection}>
            <Text style={[Typography.displayLg, { color: textColor }]}>
              {greeting}
            </Text>
            <Text style={[Typography.body, { color: textSecondary }]}>
              {t("greeting.subtitle")}
            </Text>
          </View>

          {/* Weekly Progress — gradient-washed strip */}
          <GradientSurface
            variant="surface"
            radius="lg"
            style={styles.progressCard}
          >
            <View style={styles.progressHeader}>
              <Text style={[Typography.titleSm, { color: textColor }]}>
                {t("weeklyProgress.title")}
              </Text>
              <Text
                style={[
                  Typography.titleSm,
                  { color: primary, fontVariant: ["tabular-nums"] },
                ]}
              >
                {completedCount}/{frequency}
              </Text>
            </View>
            <View
              style={styles.progressBar}
              accessibilityRole="progressbar"
              accessibilityValue={{
                min: 0,
                max: frequency,
                now: completedCount,
              }}
            >
              {progressSegmentIds.map((segmentId, i) => (
                <View
                  key={segmentId}
                  style={[
                    styles.progressSegment,
                    {
                      backgroundColor: i < completedCount ? primary : border,
                    },
                  ]}
                />
              ))}
            </View>
          </GradientSurface>

          {/* AI Generation usage (free users only) */}
          <UsageIndicator />

          {/* Active Workout (if in-progress, show above queue) */}
          {isWorkoutActive && (
            <WorkoutPlanCard
              title={workoutName}
              exercises={activeExercises}
              onStartWorkout={handleResumeWorkout}
              isActive
              startedAtMs={startedAtMs}
            />
          )}

          {/* Workout Queue */}
          <WorkoutQueue queue={queue} isLoading={isQueueLoading} />

          {/* My Workouts */}
          {(templates.length > 0 || !isWorkoutActive) && (
            <View style={styles.section}>
              <SectionHeader
                title={t("myWorkouts.title")}
                action={{
                  label: t("myWorkouts.create"),
                  icon: "plus",
                  onPress: handleCreateWorkout,
                }}
              />
              {templates.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.templateList}
                >
                  {templates.map((template) => (
                    <WorkoutTemplateCard
                      key={template.id}
                      template={template}
                      onPress={() => {
                        void handleStartTemplate(template);
                      }}
                    />
                  ))}
                </ScrollView>
              ) : (
                <Text
                  style={[
                    Typography.caption,
                    { color: textSecondary },
                    styles.emptyTemplates,
                  ]}
                >
                  {t("myWorkouts.empty")}
                </Text>
              )}
            </View>
          )}

          {/* History Link */}
          <SectionHeader
            title={t("history.seeAll")}
            action={{
              label: "View",
              icon: "chevron.right",
              onPress: () => router.push("/history"),
            }}
            style={styles.historyHeader}
          />
        </ScrollView>
      </SafeAreaView>
      <Paywall />
      {streakStatus && (
        <StreakProtectionSheet
          visible={shouldShowStreakSheet}
          status={streakStatus}
          isPending={isStreakActionPending}
          onApplyProtection={handleApplyStreakProtection}
          onComeback={handleStartComeback}
          onAdjustPlan={handleAdjustPlan}
          onUpgrade={handleUpgradeFromStreak}
          onRestart={handleRestartStreak}
          onDismiss={handleDismissStreakPrompt}
        />
      )}
    </TabScreen>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing["2xl"],
    gap: Spacing.xl,
  },
  greetingSection: {
    gap: Spacing.xs,
  },
  progressCard: {
    padding: Spacing.lg,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  progressBar: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  progressSegment: {
    flex: 1,
    height: 6,
    borderRadius: Radii.full,
  },
  section: {
    gap: Spacing.md,
  },
  templateList: {
    gap: Spacing.md,
    paddingRight: Spacing.xl,
  },
  emptyTemplates: {
    paddingVertical: Spacing.sm,
  },
  historyHeader: {
    marginTop: Spacing.md,
  },
});
