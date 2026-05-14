import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
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
import { WorkoutTemplateCard } from "@/components/workout-template-card";
import { WorkoutPlanCard } from "@/components/workout-plan-card";
import { GradientSurface } from "@/components/ui/gradient-surface";
import { SectionHeader } from "@/components/ui/section-header";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useWorkoutQueue } from "@/hooks/use-workout-queue";
import { useProfile } from "@/hooks/use-profile-query";
import { useLocalizedExerciseMap } from "@/hooks/use-exercises-query";
import { getTargetQueueCount } from "@/lib/pending-workout-queue";
import { fetchWorkoutHistoryForDayRange } from "@/lib/api/workouts";
import { getMondayLocal } from "@/lib/iso-week";
import { useWorkoutStore } from "@/stores/workout-store";
import type { WorkoutExercise } from "@/stores/workout-store";
import { useWorkoutTemplatesStore } from "@/stores/workout-templates-store";
import type { WorkoutTemplate } from "@/stores/workout-templates-store";
import { trackEvent } from "@/lib/track-event";

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

// -----------------------------------------------------------------------------
// HomeScreen
// -----------------------------------------------------------------------------

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useTranslation("home");

  // Data
  const { data: profile } = useProfile();
  const { refetch, queue } = useWorkoutQueue();
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
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

  // Colors
  const primary = useThemeColor({}, "primary");
  const border = useThemeColor({}, "border");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");

  // Handlers
  const handleCreateWorkout = useCallback(() => {
    if (!isWorkoutActive) {
      startWorkout(t("myWorkouts.newWorkoutName"), []);
    }
    router.push("/workout");
  }, [isWorkoutActive, startWorkout, t, router]);

  const handleStartTemplate = useCallback(
    (template: WorkoutTemplate) => {
      if (!isWorkoutActive) {
        const exercises: WorkoutExercise[] = template.exercises.map((ex) => ({
          id: ex.id,
          name: exerciseMap.get(ex.id)?.name ?? ex.name,
          exerciseType: "weight" as const,
          restDurationSeconds: 90,
          notes: "",
          difficultyFeedback: null,
          sets: Array.from({ length: 3 }, (_, i) => ({
            id: `set-${ex.id}-${i}-${Date.now()}`,
            type: "working" as const,
            kg: "",
            reps: "",
            durationSeconds: null,
            rpe: null,
            isCompleted: false,
            previousDisplay: null,
          })),
        }));
        startWorkout(template.name, exercises);
      }
      router.push("/workout");
    },
    [exerciseMap, isWorkoutActive, startWorkout, router]
  );

  const handleResumeWorkout = useCallback(() => {
    router.push("/workout");
  }, [router]);

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
        total_count: queue.length,
        has_active_workout: isWorkoutActive,
      });
    }, [isWorkoutActive, queue])
  );

  return (
    <View style={styles.root}>
      <AmbientGlow variant="hero" />
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scroll}
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
              {Array.from({ length: frequency }).map((_, i) => (
                <View
                  key={i}
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
          <WorkoutQueue queue={queue} />

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
                      onPress={() => handleStartTemplate(template)}
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
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  scroll: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing["2xl"],
    paddingBottom: Spacing["3xl"],
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
