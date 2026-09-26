import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";

import { AmbientGlow } from "@/components/ambient-glow";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { GradientSurface } from "@/components/ui/gradient-surface";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { useLocalizedExerciseMap } from "@/hooks/use-exercises-query";
import { useProfile } from "@/hooks/use-profile-query";
import { useThemeColor } from "@/hooks/use-theme-color";
import { fetchPreviousSetDisplays } from "@/lib/api/workouts";
import { buildTemplateWorkoutExercises } from "@/lib/start-template-workout";
import type { WeightUnit } from "@/lib/unit-conversion";
import { useWorkoutTemplatesStore } from "@/stores/workout-templates-store";
import { useWorkoutStore } from "@/stores/workout-store";

interface PersistHydrationApi {
  hasHydrated: () => boolean;
  onHydrate: (callback: () => void) => () => void;
  onFinishHydration: (callback: () => void) => () => void;
}

function usePersistHydration(persist: PersistHydrationApi): boolean {
  const [hasHydrated, setHasHydrated] = useState(() => persist.hasHydrated());

  useEffect(() => {
    const unsubscribeHydrate = persist.onHydrate(() => setHasHydrated(false));
    const unsubscribeFinish = persist.onFinishHydration(() =>
      setHasHydrated(true)
    );
    setHasHydrated(persist.hasHydrated());

    return () => {
      unsubscribeHydrate();
      unsubscribeFinish();
    };
  }, [persist]);

  return hasHydrated;
}

export default function WorkoutTemplateScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { t } = useTranslation("home");
  // Loads per account, so a switch shows the spinner rather than a template
  // from the previous account.
  const templatesHydrated = useWorkoutTemplatesStore(
    (state) => state.hasHydrated
  );
  const workoutHydrated = usePersistHydration(useWorkoutStore.persist);
  const storesHydrated = templatesHydrated && workoutHydrated;
  const startInFlightRef = useRef(false);
  const [isStarting, setIsStarting] = useState(false);
  const template = useWorkoutTemplatesStore((state) =>
    state.templates.find((item) => item.id === id)
  );
  const isWorkoutActive = useWorkoutStore((state) => state.isActive);
  const { data: profile } = useProfile();

  const exerciseIds = useMemo(
    () => template?.exercises.map((exercise) => exercise.id) ?? [],
    [template]
  );
  const { exerciseMap } = useLocalizedExerciseMap(exerciseIds);

  const text = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const primary = useThemeColor({}, "primary");
  const primarySurface = useThemeColor({}, "primarySurface");
  const warning = useThemeColor({}, "warning");
  const background = useThemeColor({}, "background");

  const handleStart = useCallback(async () => {
    if (!storesHydrated || !template || startInFlightRef.current) return;
    if (useWorkoutStore.getState().isActive) return;

    startInFlightRef.current = true;
    setIsStarting(true);

    const weightUnit: WeightUnit = (profile?.weight_unit as WeightUnit) ?? "kg";
    const previousById = await fetchPreviousSetDisplays(
      template.exercises.map((exercise) => exercise.id),
      weightUnit
    ).catch(() => ({}));

    // A workout may have been restored or started while history loaded.
    const workoutState = useWorkoutStore.getState();
    if (workoutState.isActive) {
      startInFlightRef.current = false;
      setIsStarting(false);
      return;
    }

    const exercises = buildTemplateWorkoutExercises(template.exercises, {
      resolveName: (exerciseId, fallback) =>
        exerciseMap.get(exerciseId)?.name ?? fallback,
      previousById,
    });
    workoutState.startWorkout(template.name, exercises, undefined, null, {
      workoutSource: "template",
      workoutId: template.id,
      weightUnit,
    });
    router.replace("/workout");
  }, [exerciseMap, profile?.weight_unit, router, storesHydrated, template]);

  if (!storesHydrated) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: background }]}>
        <AmbientGlow variant="hero" />
        <View
          style={styles.loading}
          accessibilityRole="progressbar"
          accessibilityLabel={t("templateDetail.loading")}
        >
          <ActivityIndicator color={primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!template) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: background }]}>
        <AmbientGlow variant="hero" />
        <View style={styles.notFound}>
          <BackButton
            label={t("templateDetail.back")}
            accessibilityLabel={t("templateDetail.back")}
          />
          <Text style={[Typography.titleLg, { color: text }]}>
            {t("templateDetail.notFoundTitle")}
          </Text>
          <Text style={[Typography.body, { color: textSecondary }]}>
            {t("templateDetail.notFoundMessage")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: background }]}>
      <AmbientGlow variant="hero" />
      <View style={styles.header}>
        <BackButton
          label={t("templateDetail.back")}
          accessibilityLabel={t("templateDetail.back")}
        />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleSection}>
          <View style={[styles.modeBadge, { backgroundColor: primarySurface }]}>
            <Text style={[Typography.label, { color: primary }]}>
              {t("templateDetail.modeLabel")}
            </Text>
          </View>
          <Text style={[Typography.displayLg, { color: text }]}>
            {template.name}
          </Text>
          <Text style={[Typography.body, { color: textSecondary }]}>
            {t("templateDetail.description")}
          </Text>
        </View>

        <View style={styles.exerciseSection}>
          <Text style={[Typography.titleMd, { color: text }]}>
            {t("templateDetail.exercisesTitle")}
          </Text>
          <View style={styles.exerciseList}>
            {template.exercises.map((exercise, index) => (
              <GradientSurface
                key={exercise.id}
                variant="surface"
                radius="lg"
                bordered
                style={styles.exerciseCard}
              >
                <View
                  style={[
                    styles.exerciseNumber,
                    { backgroundColor: primarySurface },
                  ]}
                >
                  <Text style={[Typography.titleSm, { color: primary }]}>
                    {index + 1}
                  </Text>
                </View>
                <Text style={[Typography.bodyMedium, { color: text }]}>
                  {exerciseMap.get(exercise.id)?.name ?? exercise.name}
                </Text>
              </GradientSurface>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: background }]}>
        {isWorkoutActive ? (
          <View style={styles.activeWorkoutMessage}>
            <Text style={[Typography.titleSm, { color: warning }]}>
              {t("templateDetail.activeWorkoutTitle")}
            </Text>
            <Text style={[Typography.caption, { color: textSecondary }]}>
              {t("templateDetail.activeWorkoutMessage")}
            </Text>
          </View>
        ) : null}
        <Button
          label={t("templateDetail.startWorkout")}
          accessibilityLabel={t("templateDetail.startWorkout")}
          onPress={handleStart}
          disabled={isWorkoutActive}
          loading={isStarting}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    alignItems: "flex-start",
  },
  content: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing["3xl"],
    gap: Spacing["2xl"],
  },
  titleSection: {
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  modeBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.full,
  },
  exerciseSection: {
    gap: Spacing.md,
  },
  exerciseList: {
    gap: Spacing.sm,
  },
  exerciseCard: {
    padding: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  exerciseNumber: {
    width: 32,
    height: 32,
    borderRadius: Radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
  activeWorkoutMessage: {
    gap: Spacing.xs,
  },
  notFound: {
    flex: 1,
    padding: Spacing.xl,
    gap: Spacing.md,
    alignItems: "flex-start",
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
