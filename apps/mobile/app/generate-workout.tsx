import { useThemeColor } from "@/hooks/use-theme-color";
import { useGenerateWorkout } from "@/hooks/use-generate-workout";
import { useWorkoutStore } from "@/stores/workout-store";
import type { GenerationMeta } from "@/stores/workout-store";
import {
  mapGeneratedToWorkoutExercises,
  RateLimitError,
} from "@/lib/api/ai-workout";
import type {
  FocusArea,
  Duration,
  GenerateWorkoutResponse,
  GeneratedExercise,
} from "@/lib/api/ai-workout";
import { Button } from "@/components/ui/button";
import { Elevation, Radii, Spacing, Typography } from "@/constants/theme";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
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

// -----------------------------------------------------------------------------
// Option Data
// -----------------------------------------------------------------------------

const FOCUS_OPTIONS = [
  { value: "push" as const, label: "focusArea.push" as const },
  { value: "pull" as const, label: "focusArea.pull" as const },
  { value: "legs" as const, label: "focusArea.legs" as const },
  { value: "upper" as const, label: "focusArea.upper" as const },
  { value: "lower" as const, label: "focusArea.lower" as const },
  { value: "full_body" as const, label: "focusArea.fullBody" as const },
];

const DURATION_OPTIONS: Duration[] = [30, 45, 60];

// -----------------------------------------------------------------------------
// Pill Selector Component
// -----------------------------------------------------------------------------

interface PillProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

function Pill({ label, selected, onPress }: PillProps) {
  const primary = useThemeColor({}, "primary");
  const primaryContainer = useThemeColor({}, "primaryContainer");
  const inputFill = useThemeColor({}, "inputFill");
  const textColor = useThemeColor({}, "text");

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.pill,
        {
          backgroundColor: selected ? primaryContainer : inputFill,
          borderColor: selected ? primary : "transparent",
          borderWidth: 1.5,
        },
      ]}
    >
      <Text
        style={[
          Typography.bodyMedium,
          { color: selected ? primary : textColor },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// -----------------------------------------------------------------------------
// Exercise Preview Card
// -----------------------------------------------------------------------------

interface ExercisePreviewProps {
  exercise: GeneratedExercise;
  index: number;
  onSwap: () => void;
}

function ExercisePreview({ exercise, index, onSwap }: ExercisePreviewProps) {
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const backgroundSubtle = useThemeColor({}, "backgroundSubtle");
  const borderSubtle = useThemeColor({}, "borderSubtle");
  const primary = useThemeColor({}, "primary");
  const { t } = useTranslation("generateWorkout");

  const workingSets = exercise.sets.filter((s) => s.set_type === "working");
  const warmupSets = exercise.sets.filter((s) => s.set_type === "warmup");

  return (
    <View
      style={[
        styles.exerciseCard,
        { backgroundColor: backgroundSubtle },
        Elevation.sm,
      ]}
    >
      <View style={styles.exerciseHeader}>
        <View style={styles.exerciseInfo}>
          <Text style={[Typography.bodyMedium, { color: textColor }]}>
            {index + 1}. {exercise.exercise_name}
          </Text>
          <Text style={[Typography.caption, { color: textMuted }]}>
            {t("result.rest", { seconds: exercise.rest_duration_seconds })}
          </Text>
        </View>
        <Pressable onPress={onSwap} accessibilityRole="button">
          <Text style={[Typography.caption, { color: primary }]}>Swap</Text>
        </Pressable>
      </View>

      {warmupSets.length > 0 && (
        <View style={styles.setRow}>
          <Text style={[Typography.caption, { color: textMuted }]}>
            {t("result.warmup")}
          </Text>
          <Text style={[Typography.caption, { color: textSecondary }]}>
            {warmupSets
              .map((s) => `${s.target_load_kg}kg×${s.target_reps}`)
              .join(", ")}
          </Text>
        </View>
      )}

      {workingSets.length > 0 && (
        <View
          style={[
            styles.setRow,
            warmupSets.length > 0 && {
              borderTopWidth: 1,
              borderTopColor: borderSubtle,
            },
          ]}
        >
          <Text style={[Typography.caption, { color: textMuted }]}>
            {t("result.working")}
          </Text>
          <Text style={[Typography.caption, { color: textSecondary }]}>
            {workingSets.length}×{workingSets[0].target_load_kg}kg×
            {workingSets[0].target_reps}
          </Text>
        </View>
      )}

      {exercise.notes && (
        <Text style={[Typography.caption, { color: textMuted }, styles.notes]}>
          {exercise.notes}
        </Text>
      )}
    </View>
  );
}

// -----------------------------------------------------------------------------
// Main Screen
// -----------------------------------------------------------------------------

export default function GenerateWorkoutScreen() {
  const { t } = useTranslation("generateWorkout");
  const router = useRouter();
  const startWorkout = useWorkoutStore((s) => s.startWorkout);
  const isWorkoutActive = useWorkoutStore((s) => s.isActive);

  const background = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const primary = useThemeColor({}, "primary");
  const errorColor = useThemeColor({}, "error");

  const [focusArea, setFocusArea] = useState<FocusArea | null>(null);
  const [duration, setDuration] = useState<Duration | null>(null);
  const [result, setResult] = useState<GenerateWorkoutResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const generateMutation = useGenerateWorkout();

  const handleGenerate = useCallback(() => {
    if (!focusArea || !duration) return;
    setErrorMessage(null);

    generateMutation.mutate(
      { focus_area: focusArea, duration_minutes: duration },
      {
        onSuccess: (data) => setResult(data),
        onError: (err) => {
          if (err instanceof RateLimitError) {
            setErrorMessage(
              t("error.rateLimited", { seconds: err.retryAfter })
            );
          } else {
            setErrorMessage(t("error.failed"));
          }
        },
      }
    );
  }, [focusArea, duration, generateMutation, t]);

  const handleStartWorkout = useCallback(() => {
    if (!result || isWorkoutActive) return;

    const exercises = mapGeneratedToWorkoutExercises(result.exercises);
    const meta: GenerationMeta = {
      generationSource: result.generation_source,
      goalSnapshot: result.goal_snapshot,
      customGoalSnapshot: result.custom_goal_snapshot,
    };

    startWorkout(result.workout_name, exercises, meta);
    router.push("/workout");
  }, [result, isWorkoutActive, startWorkout, router]);

  const handleSwapExercise = useCallback(
    (_exerciseId: string) => {
      router.push({
        pathname: "/exercise-picker",
        params: { mode: "replace", exerciseId: _exerciseId },
      });
    },
    [router]
  );

  const canGenerate = focusArea !== null && duration !== null;
  const isLoading = generateMutation.isPending;

  return (
    <View style={[styles.root, { backgroundColor: background }]}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={[Typography.body, { color: primary }]}>Back</Text>
          </Pressable>
          <Text style={[Typography.titleLg, { color: textColor }]}>
            {result ? result.workout_name : t("title")}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Configuration Section */}
          {!result && !isLoading && (
            <>
              <Text style={[Typography.titleSm, { color: textColor }]}>
                {t("focusArea.label")}
              </Text>
              <View style={styles.pillGrid}>
                {FOCUS_OPTIONS.map((opt) => (
                  <Pill
                    key={opt.value}
                    label={t(opt.label)}
                    selected={focusArea === opt.value}
                    onPress={() => setFocusArea(opt.value)}
                  />
                ))}
              </View>

              <Text
                style={[
                  Typography.titleSm,
                  { color: textColor },
                  styles.sectionLabel,
                ]}
              >
                {t("duration.label")}
              </Text>
              <View style={styles.pillRow}>
                {DURATION_OPTIONS.map((d) => (
                  <Pill
                    key={d}
                    label={t("duration.minutes", { count: d })}
                    selected={duration === d}
                    onPress={() => setDuration(d)}
                  />
                ))}
              </View>
            </>
          )}

          {/* Loading State */}
          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={primary} />
              <Text
                style={[
                  Typography.body,
                  { color: textSecondary },
                  styles.loadingText,
                ]}
              >
                {t("generating")}
              </Text>
            </View>
          )}

          {/* Error State */}
          {errorMessage && (
            <Text
              style={[Typography.body, { color: errorColor }, styles.error]}
            >
              {errorMessage}
            </Text>
          )}

          {/* Result Preview */}
          {result && !isLoading && (
            <View style={styles.exerciseList}>
              {result.exercises.map((ex, i) => (
                <ExercisePreview
                  key={ex.exercise_id}
                  exercise={ex}
                  index={i}
                  onSwap={() => handleSwapExercise(ex.exercise_id)}
                />
              ))}
            </View>
          )}
        </ScrollView>

        {/* Bottom Actions */}
        <View style={styles.footer}>
          {!result && !isLoading && (
            <Button
              label={t("generate")}
              onPress={handleGenerate}
              disabled={!canGenerate}
            />
          )}
          {result && !isLoading && (
            <>
              <Button
                label={t("result.startWorkout")}
                onPress={handleStartWorkout}
                disabled={isWorkoutActive}
              />
              <Button
                label={t("result.regenerate")}
                onPress={() => {
                  setResult(null);
                  handleGenerate();
                }}
                variant="ghost"
              />
            </>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  headerSpacer: { width: 40 },
  scroll: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing["3xl"],
  },
  pillGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  pillRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  pill: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radii.full,
  },
  sectionLabel: {
    marginTop: Spacing["2xl"],
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["5xl"],
  },
  loadingText: {
    marginTop: Spacing.lg,
  },
  error: {
    textAlign: "center",
    marginTop: Spacing.lg,
  },
  exerciseList: {
    gap: Spacing.md,
  },
  exerciseCard: {
    borderRadius: Radii.lg,
    padding: Spacing.lg,
  },
  exerciseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  exerciseInfo: {
    flex: 1,
    gap: 2,
  },
  setRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: Spacing.xs,
  },
  notes: {
    marginTop: Spacing.sm,
    fontStyle: "italic",
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing["3xl"],
    gap: Spacing.md,
  },
});
