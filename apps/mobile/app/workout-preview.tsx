import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { AmbientGlow } from "@/components/ambient-glow";
import { ExerciseImage } from "@/components/exercise/exercise-image";
import { ExercisePreferenceIcon } from "@/components/exercise/exercise-preference-icon";
import { ExercisePreferenceSheet } from "@/components/exercise/exercise-preference-sheet";
import { Button } from "@/components/ui/button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenHeader } from "@/components/ui/screen-header";
import { ProgressionPill } from "@/components/workout/progression-pill";
import { ReasoningDisclosure } from "@/components/workout/reasoning-disclosure";
import { Opacity, Radii, Spacing, Typography } from "@/constants/theme";
import {
  useRemoveExercisePreference,
  useSetExercisePreference,
} from "@/hooks/use-exercise-preference-mutations";
import { useExercisePreferences } from "@/hooks/use-exercise-preference-query";
import { useLocalizedExerciseMap } from "@/hooks/use-exercises-query";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useWeightUnit } from "@/hooks/use-weight-unit";
import {
  useEditPendingWorkout,
  useRegenerateWorkout,
  useStartPendingWorkout,
  useWorkoutQueueData,
} from "@/hooks/use-workout-queue";
import type { ExercisePreferenceValue } from "@/lib/api/exercise-preferences";
import type { ExerciseImageData } from "@/lib/exercise-media";
import { formatExerciseDuration } from "@/lib/format-exercise-duration";
import { getPendingWorkoutRegenerationEligibility } from "@/lib/pending-workout-regeneration";
import { trackEvent } from "@/lib/track-event";
import { usePendingSwapStore } from "@/stores/pending-swap-store";
import { selectNextWorkout } from "@/stores/pending-workout-store";
import type { WorkoutExerciseReasoning } from "@/stores/workout-store";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface LocalExercise {
  exercise_id: string;
  exercise_name: string;
  exercise_type?: "weight" | "time";
  image?: ExerciseImageData;
  rest_duration_seconds: number;
  notes: string | null;
  reasoning?: WorkoutExerciseReasoning | null;
  sets: LocalSet[];
  progression_type?:
    | "weight_up"
    | "reps_up"
    | "maintained"
    | "new_exercise"
    | null;
  previous_display?: string | null;
}

interface LocalSet {
  set_type: "warmup" | "working";
  target_load_kg: number | null;
  target_reps: number | null;
  target_duration_seconds?: number | null;
}

interface LocalWarmup {
  duration_seconds: number;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function estimateMinutes(
  exercises: LocalExercise[],
  warmup: LocalWarmup | null
): number {
  const totalSets = exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
  const avgRest =
    exercises.length > 0 ? exercises[0].rest_duration_seconds : 90;
  const exerciseSeconds = totalSets * 45 + (totalSets - 1) * avgRest;
  return Math.round((exerciseSeconds + (warmup?.duration_seconds ?? 0)) / 60);
}

// -----------------------------------------------------------------------------
// Screen
// -----------------------------------------------------------------------------

export default function WorkoutPreviewScreen() {
  const { t } = useTranslation("workoutPreview");
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  // Theme
  const background = useThemeColor({}, "background");
  const text = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const textDisabled = useThemeColor({}, "textDisabled");
  const primary = useThemeColor({}, "primary");
  const primarySurface = useThemeColor({}, "primarySurface");
  const primaryContainer = useThemeColor({}, "primaryContainer");
  const backgroundElevated = useThemeColor({}, "backgroundElevated");
  const border = useThemeColor({}, "border");
  const inputFill = useThemeColor({}, "inputFill");
  const inputFillFocused = useThemeColor({}, "inputFillFocused");

  // Queue data
  const { queue } = useWorkoutQueueData();
  const nextWorkout = selectNextWorkout(queue);
  const workout = queue.find((w) => w.id === id) ?? null;
  const isNextUp = nextWorkout?.id === id;
  const isRegenerating = workout?.status === "regenerating";

  // Mutations
  const startMutation = useStartPendingWorkout();
  const regenerateMutation = useRegenerateWorkout();
  const editMutation = useEditPendingWorkout();

  // Local edit state
  const [isEditing, setIsEditing] = useState(false);
  const [localExercises, setLocalExercises] = useState<LocalExercise[]>([]);
  const [dirtyEditTypes, setDirtyEditTypes] = useState<string[]>([]);
  const [prefSheetExerciseId, setPrefSheetExerciseId] = useState<string | null>(
    null
  );
  const [regenerateSheetVisible, setRegenerateSheetVisible] = useState(false);
  const [regenerationFeedback, setRegenerationFeedback] = useState("");
  const swapIndexRef = useRef<number | null>(null);
  const openedAtRef = useRef(Date.now());
  const swapResult = usePendingSwapStore((s) => s.result);
  const setSwapResult = usePendingSwapStore((s) => s.setResult);

  // Exercise preferences
  const exerciseIds = localExercises.map((e) => e.exercise_id);
  const { data: preferencesMap } = useExercisePreferences(exerciseIds);
  const { exerciseMap } = useLocalizedExerciseMap(exerciseIds);
  const setPreferenceMutation = useSetExercisePreference();
  const removePreferenceMutation = useRemoveExercisePreference();
  const prefSheetExercise = localExercises.find(
    (e) => e.exercise_id === prefSheetExerciseId
  );

  const markEditType = useCallback((editType: string) => {
    setDirtyEditTypes((prev) =>
      prev.includes(editType) ? prev : [...prev, editType]
    );
  }, []);

  // Initialize local exercises from workout data
  useEffect(() => {
    if (workout?.workout_data) {
      const editedExercises = Array.isArray(
        (workout.user_edits as { exercises?: LocalExercise[] } | null)
          ?.exercises
      )
        ? (
            workout.user_edits as {
              exercises?: LocalExercise[];
            }
          ).exercises
        : null;

      setLocalExercises(
        (editedExercises ?? workout.workout_data.exercises).map((ex) => ({
          exercise_id: ex.exercise_id,
          exercise_name: ex.exercise_name,
          exercise_type: ex.exercise_type ?? "weight",
          image: ex.image ?? null,
          rest_duration_seconds: ex.rest_duration_seconds,
          notes: ex.notes,
          reasoning: ex.reasoning ?? null,
          progression_type: ex.progression_type ?? null,
          previous_display: ex.previous_display ?? null,
          sets: ex.sets.map((s) => ({
            set_type: s.set_type,
            target_load_kg: s.target_load_kg ?? null,
            target_reps: s.target_reps ?? null,
            target_duration_seconds:
              (s as { target_duration_seconds?: number | null })
                .target_duration_seconds ?? null,
          })),
        }))
      );
      setDirtyEditTypes(
        Array.isArray(
          (workout.user_edits as { edit_types?: string[] } | null)?.edit_types
        )
          ? ((
              workout.user_edits as {
                edit_types?: string[];
              }
            ).edit_types ?? [])
          : []
      );
    }
  }, [workout?.workout_data]);

  useEffect(() => {
    openedAtRef.current = Date.now();
  }, [id]);

  useEffect(() => {
    if (isRegenerating) {
      setIsEditing(false);
    }
  }, [isRegenerating]);

  useEffect(() => {
    return () => {
      if (!workout) return;

      trackEvent("workout_preview_viewed", {
        queue_position: workout.queue_position,
        time_on_screen_ms: Math.max(0, Date.now() - openedAtRef.current),
      });
    };
  }, [workout]);

  // Handle swap result returning from exercise picker
  useFocusEffect(
    useCallback(() => {
      if (swapResult && swapIndexRef.current !== null) {
        setLocalExercises((prev) =>
          prev.map((ex, i) =>
            i === swapIndexRef.current
              ? {
                  ...ex,
                  exercise_id: swapResult.id,
                  exercise_name: swapResult.name,
                  exercise_type: swapResult.exerciseType ?? ex.exercise_type,
                  image: swapResult.image ?? null,
                  reasoning: null,
                }
              : ex
          )
        );
        markEditType("swap_exercise");
        swapIndexRef.current = null;
        setSwapResult(null);
      }
    }, [markEditType, swapResult, setSwapResult])
  );

  // Handlers
  const handleStart = useCallback(() => {
    if (!workout || isRegenerating) return;
    startMutation.mutate({
      pendingWorkout: workout,
      exercises: localExercises,
      wasEdited: dirtyEditTypes.length > 0 || workout.user_edits !== null,
      editCount: dirtyEditTypes.length,
    });
  }, [
    dirtyEditTypes.length,
    isRegenerating,
    localExercises,
    startMutation,
    workout,
  ]);

  const handleRegenerate = useCallback(() => {
    if (!workout || isRegenerating) return;
    setRegenerationFeedback("");
    setRegenerateSheetVisible(true);
  }, [isRegenerating, workout]);

  const submitRegeneration = useCallback(
    (feedback?: string) => {
      if (!workout || isRegenerating) return;

      const trimmedFeedback = feedback?.trim();
      setRegenerateSheetVisible(false);
      regenerateMutation.mutate({
        pendingWorkout: workout,
        feedback: trimmedFeedback ? trimmedFeedback : undefined,
      });
    },
    [isRegenerating, regenerateMutation, workout]
  );

  const persistEdits = useCallback(() => {
    if (!workout || dirtyEditTypes.length === 0 || isRegenerating) return;

    editMutation.mutate({
      id: workout.id,
      edits: {
        exercises: localExercises,
        edit_types: dirtyEditTypes,
        edited_at: new Date().toISOString(),
      },
      editType: dirtyEditTypes.length === 1 ? dirtyEditTypes[0] : "multiple",
    });
  }, [dirtyEditTypes, editMutation, isRegenerating, localExercises, workout]);

  const handleSwap = useCallback(
    (exerciseIndex: number) => {
      if (isRegenerating) return;
      swapIndexRef.current = exerciseIndex;
      setSwapResult(null);
      router.push("/exercise-picker?mode=pending_swap" as never);
    },
    [isRegenerating, router, setSwapResult]
  );

  const handleUpdateSet = useCallback(
    (
      exerciseIndex: number,
      setIndex: number,
      field: "target_load_kg" | "target_reps",
      rawValue: string
    ) => {
      const value = rawValue === "" ? 0 : Number(rawValue);
      if (rawValue !== "" && isNaN(value)) return;

      markEditType(field === "target_load_kg" ? "change_load" : "change_sets");
      setLocalExercises((prev) =>
        prev.map((ex, i) =>
          i === exerciseIndex
            ? {
                ...ex,
                sets: ex.sets.map((s, j) =>
                  j === setIndex ? { ...s, [field]: value } : s
                ),
              }
            : ex
        )
      );
    },
    [markEditType]
  );

  const handleToggleEdit = useCallback(() => {
    if (isRegenerating) return;

    setIsEditing((prev) => {
      if (prev) {
        persistEdits();
      }

      return !prev;
    });
  }, [isRegenerating, persistEdits]);

  // Loading / empty states
  if (!workout || !workout.workout_data) {
    return (
      <View style={[styles.root, { backgroundColor: background }]}>
        <AmbientGlow variant="subtle" />
        <SafeAreaProvider>
          <SafeAreaView style={styles.safe}>
            <ScreenHeader />
            <View style={styles.emptyContainer}>
              <IconSymbol name="flame" size={40} color={textDisabled} />
              <Text style={[Typography.body, { color: textMuted }]}>
                {t("empty.title")}
              </Text>
              <Text style={[Typography.caption, { color: textDisabled }]}>
                {t("empty.subtitle")}
              </Text>
            </View>
          </SafeAreaView>
        </SafeAreaProvider>
      </View>
    );
  }

  const warmup = workout.workout_data.warmup;
  const estimatedMinutes = estimateMinutes(localExercises, warmup);
  const regenerationEligibility = getPendingWorkoutRegenerationEligibility(
    workout.last_regenerated_at
  );
  const regenerable = regenerationEligibility.canRegenerate && !isRegenerating;
  const canEdit = isEditing && !isRegenerating;
  const showFooter = isNextUp || regenerable || isRegenerating;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <AmbientGlow variant="subtle" />
      <SafeAreaProvider>
        <SafeAreaView style={styles.safe}>
          {/* Header */}
          <ScreenHeader
            title={workout.workout_data.workout_name}
            titleStyle={Typography.titleMd}
            numberOfLines={1}
            rightElement={
              <Pressable
                onPress={handleToggleEdit}
                disabled={isRegenerating}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityState={{ disabled: isRegenerating }}
                accessibilityLabel={
                  isEditing ? t("edit.done") : t("edit.toggle")
                }
              >
                <Text
                  style={[
                    Typography.bodyMedium,
                    { color: isRegenerating ? textMuted : primary },
                  ]}
                >
                  {isEditing ? t("edit.done") : t("edit.toggle")}
                </Text>
              </Pressable>
            }
          />

          {/* Scrollable content */}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            {/* Meta badges */}
            <View style={styles.metaRow}>
              {workout.focus_area && (
                <View
                  style={[styles.badge, { backgroundColor: primarySurface }]}
                >
                  <Text style={[Typography.caption, { color: primary }]}>
                    {workout.focus_area
                      .replace("_", " ")
                      .replace(/\b\w/g, (c) => c.toUpperCase())}
                  </Text>
                </View>
              )}
              <View
                style={[styles.badge, { backgroundColor: primaryContainer }]}
              >
                <IconSymbol name="clock" size={12} color={primary} />
                <Text style={[Typography.caption, { color: primary }]}>
                  {t("meta.duration", { minutes: estimatedMinutes })}
                </Text>
              </View>
              <View
                style={[styles.badge, { backgroundColor: primaryContainer }]}
              >
                <IconSymbol name="dumbbell" size={12} color={primary} />
                <Text style={[Typography.caption, { color: primary }]}>
                  {t("meta.exercises", {
                    count: localExercises.length,
                  })}
                </Text>
              </View>
            </View>

            <ReasoningDisclosure
              title={t("reasoning.planTitle")}
              showLabel={t("reasoning.show")}
              hideLabel={t("reasoning.hide")}
              accessibilityLabel={t("reasoning.planAccessibility")}
              style={styles.planReasoning}
              entries={[
                {
                  label: t("reasoning.muscleGroups"),
                  text: workout.workout_data.reasoning?.muscle_groups,
                },
                {
                  label: t("reasoning.trainingStrategy"),
                  text: workout.workout_data.reasoning?.training_strategy,
                },
              ]}
            />

            {isRegenerating ? (
              <View
                style={[
                  styles.statusCard,
                  {
                    backgroundColor: primaryContainer,
                    borderColor: border,
                  },
                ]}
              >
                <View style={styles.statusCardHeader}>
                  <View
                    style={[styles.statusDot, { backgroundColor: primary }]}
                  />
                  <Text style={[Typography.titleSm, { color: primary }]}>
                    {t("status.regeneratingTitle")}
                  </Text>
                </View>
                <Text style={[Typography.caption, { color: textSecondary }]}>
                  {t("status.regeneratingMessage")}
                </Text>
              </View>
            ) : (
              <Text
                style={[
                  Typography.caption,
                  styles.regenerationStatusText,
                  { color: textMuted },
                ]}
              >
                {regenerationEligibility.canRegenerate
                  ? t("actions.regenerationAvailable")
                  : t("actions.regenerationUnavailableToday")}
              </Text>
            )}

            {warmup ? (
              <View
                style={[
                  styles.warmupCard,
                  {
                    backgroundColor: primaryContainer,
                    borderColor: border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.warmupIcon,
                    { backgroundColor: primarySurface },
                  ]}
                >
                  <IconSymbol name="timer" size={18} color={primary} />
                </View>
                <View style={styles.warmupText}>
                  <Text style={[Typography.titleSm, { color: text }]}>
                    {t("warmup.title")}
                  </Text>
                  <Text style={[Typography.caption, { color: textSecondary }]}>
                    {t("warmup.timer", {
                      time: formatExerciseDuration(warmup.duration_seconds),
                    })}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Exercise list */}
            <View style={styles.exerciseList}>
              {localExercises.map((exercise, exIndex) => (
                <ExerciseCard
                  key={`${exercise.exercise_id}-${exIndex}`}
                  exercise={exercise}
                  displayName={
                    exerciseMap.get(exercise.exercise_id)?.name ??
                    exercise.exercise_name
                  }
                  image={
                    exercise.image ??
                    exerciseMap.get(exercise.exercise_id)?.image
                  }
                  exerciseIndex={exIndex}
                  isEditing={canEdit}
                  preference={preferencesMap?.get(exercise.exercise_id) ?? null}
                  text={text}
                  textSecondary={textSecondary}
                  textMuted={textMuted}
                  border={border}
                  backgroundElevated={backgroundElevated}
                  inputFill={inputFill}
                  inputFillFocused={inputFillFocused}
                  primary={primary}
                  primarySurface={primarySurface}
                  onUpdateSet={handleUpdateSet}
                  onSwap={handleSwap}
                  onOpenPreference={() =>
                    setPrefSheetExerciseId(exercise.exercise_id)
                  }
                  t={t}
                />
              ))}
            </View>

            <View style={styles.bottomPadding} />
          </ScrollView>

          {/* Exercise Preference Sheet */}
          <ExercisePreferenceSheet
            visible={prefSheetExerciseId !== null}
            exerciseName={
              prefSheetExercise
                ? (exerciseMap.get(prefSheetExercise.exercise_id)?.name ??
                  prefSheetExercise.exercise_name)
                : ""
            }
            currentPreference={
              prefSheetExerciseId
                ? (preferencesMap?.get(prefSheetExerciseId) ?? null)
                : null
            }
            onClose={() => setPrefSheetExerciseId(null)}
            onSelect={(pref) => {
              if (!prefSheetExerciseId) return;
              if (pref === null) {
                removePreferenceMutation.mutate(prefSheetExerciseId);
              } else {
                setPreferenceMutation.mutate({
                  exerciseId: prefSheetExerciseId,
                  preference: pref,
                });
              }
            }}
          />

          <RegenerationFeedbackSheet
            visible={regenerateSheetVisible}
            feedback={regenerationFeedback}
            onFeedbackChange={setRegenerationFeedback}
            onClose={() => setRegenerateSheetVisible(false)}
            onSubmit={() => submitRegeneration(regenerationFeedback)}
            onSkip={() => submitRegeneration()}
            text={text}
            textSecondary={textSecondary}
            textMuted={textMuted}
            background={backgroundElevated}
            border={border}
            inputFill={inputFill}
            primary={primary}
            primarySurface={primarySurface}
            t={t}
          />

          {/* Footer actions */}
          {showFooter ? (
            <View style={[styles.footer, { backgroundColor: background }]}>
              {isNextUp && (
                <Button
                  label={t("actions.startWorkout")}
                  onPress={handleStart}
                  disabled={isRegenerating}
                  accessibilityLabel={t("actions.startWorkout")}
                />
              )}
              {isRegenerating ? (
                <View
                  style={[
                    styles.regenerateDisabled,
                    { backgroundColor: primaryContainer },
                  ]}
                >
                  <Text style={[Typography.titleSm, { color: primary }]}>
                    {t("actions.regenerating")}
                  </Text>
                </View>
              ) : regenerable ? (
                <Button
                  label={t("actions.regenerate")}
                  onPress={handleRegenerate}
                  variant="secondary"
                  accessibilityLabel={t("actions.regenerate")}
                />
              ) : null}
            </View>
          ) : null}
        </SafeAreaView>
      </SafeAreaProvider>
    </KeyboardAvoidingView>
  );
}

// -----------------------------------------------------------------------------
// RegenerationFeedbackSheet
// -----------------------------------------------------------------------------

interface RegenerationFeedbackSheetProps {
  visible: boolean;
  feedback: string;
  onFeedbackChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  onSkip: () => void;
  text: string;
  textSecondary: string;
  textMuted: string;
  background: string;
  border: string;
  inputFill: string;
  primary: string;
  primarySurface: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: TFunction<any, any>;
}

function RegenerationFeedbackSheet({
  visible,
  feedback,
  onFeedbackChange,
  onClose,
  onSubmit,
  onSkip,
  text,
  textSecondary,
  textMuted,
  background,
  border,
  inputFill,
  primary,
  primarySurface,
  t,
}: RegenerationFeedbackSheetProps) {
  const trimmedFeedback = feedback.trim();
  const hasFeedback = trimmedFeedback.length > 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.regenerationBackdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t("regenerate.dismiss")}
      >
        <Pressable
          style={[styles.regenerationSheet, { backgroundColor: background }]}
          onPress={(event) => event.stopPropagation()}
          accessibilityViewIsModal
        >
          <View style={[styles.sheetHandle, { backgroundColor: textMuted }]} />

          <View
            style={[
              styles.regenerationIcon,
              { backgroundColor: primarySurface },
            ]}
          >
            <IconSymbol name="sparkles" size={20} color={primary} />
          </View>

          <Text style={[Typography.titleMd, { color: text }]}>
            {t("regenerate.sheetTitle")}
          </Text>
          <Text
            style={[
              Typography.caption,
              styles.regenerationSheetCopy,
              { color: textSecondary },
            ]}
          >
            {t("regenerate.sheetMessage")}
          </Text>

          <TextInput
            value={feedback}
            onChangeText={onFeedbackChange}
            placeholder={t("regenerate.feedbackPlaceholder")}
            placeholderTextColor={textMuted}
            multiline
            maxLength={300}
            textAlignVertical="top"
            style={[
              styles.feedbackInput,
              {
                backgroundColor: inputFill,
                borderColor: hasFeedback ? primary : border,
                color: text,
              },
            ]}
            accessibilityLabel={t("regenerate.feedbackAccessibilityLabel")}
          />

          <Text style={[Typography.micro, { color: textMuted }]}>
            {t("regenerate.feedbackCount", {
              count: trimmedFeedback.length,
              max: 300,
            })}
          </Text>

          <View style={styles.regenerationActions}>
            <Pressable
              onPress={onSubmit}
              accessibilityRole="button"
              accessibilityLabel={t("regenerate.confirm")}
              style={({ pressed }) => [
                styles.regenerationPrimaryAction,
                {
                  backgroundColor: primary,
                  opacity: pressed ? Opacity.pressed : 1,
                },
              ]}
            >
              <IconSymbol name="arrow.clockwise" size={16} color="#FFFFFF" />
              <Text
                style={[
                  Typography.titleSm,
                  styles.regenerationPrimaryActionText,
                ]}
              >
                {hasFeedback
                  ? t("regenerate.confirmWithFeedback")
                  : t("regenerate.confirm")}
              </Text>
            </Pressable>

            <Pressable
              onPress={onSkip}
              accessibilityRole="button"
              accessibilityLabel={t("regenerate.skipFeedback")}
              style={({ pressed }) => [
                styles.regenerationSecondaryAction,
                {
                  borderColor: border,
                  opacity: pressed ? Opacity.pressed : 1,
                },
              ]}
            >
              <Text style={[Typography.titleSm, { color: textSecondary }]}>
                {t("regenerate.skipFeedback")}
              </Text>
            </Pressable>
          </View>

          <Text
            style={[
              Typography.micro,
              styles.regenerationLimitNote,
              { color: textMuted },
            ]}
          >
            {t("regenerate.limitNote")}
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// -----------------------------------------------------------------------------
// ExerciseCard
// -----------------------------------------------------------------------------

interface ExerciseCardProps {
  exercise: LocalExercise;
  displayName: string;
  image?: ExerciseImageData;
  exerciseIndex: number;
  isEditing: boolean;
  preference: ExercisePreferenceValue | null | undefined;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  backgroundElevated: string;
  inputFill: string;
  inputFillFocused: string;
  primary: string;
  primarySurface: string;
  onUpdateSet: (
    exIndex: number,
    setIndex: number,
    field: "target_load_kg" | "target_reps",
    value: string
  ) => void;
  onSwap: (exerciseIndex: number) => void;
  onOpenPreference: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: TFunction<any, any>;
}

function ExerciseCard({
  exercise,
  displayName,
  image,
  exerciseIndex,
  isEditing,
  preference,
  text,
  textSecondary,
  textMuted,
  border,
  backgroundElevated,
  inputFill,
  inputFillFocused,
  primary,
  primarySurface,
  onUpdateSet,
  onSwap,
  onOpenPreference,
  t,
}: ExerciseCardProps) {
  return (
    <View
      style={[
        styles.exerciseCard,
        { backgroundColor: backgroundElevated, borderColor: border },
      ]}
    >
      {/* Exercise header */}
      <View style={styles.exerciseHeader}>
        <ExerciseImage
          image={image}
          exerciseName={displayName}
          size="thumbnail"
        />
        <View style={styles.exerciseHeaderLeft}>
          <View style={styles.exerciseNameRow}>
            <Text
              style={[Typography.titleSm, { color: text, flex: 1 }]}
              numberOfLines={1}
            >
              {displayName}
            </Text>
            <Pressable
              onPress={onOpenPreference}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              accessibilityRole="button"
              accessibilityLabel={t("exerciseList.preference", {
                ns: "exercisePreference",
              })}
            >
              <ExercisePreferenceIcon
                preference={preference ?? null}
                size={18}
              />
            </Pressable>
            <ProgressionPill type={exercise.progression_type} />
          </View>
          <View style={styles.exerciseMeta}>
            <Text style={[Typography.micro, { color: textMuted }]}>
              {t("exerciseList.rest", {
                seconds: exercise.rest_duration_seconds,
              })}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => onSwap(exerciseIndex)}
          style={({ pressed }) => [
            styles.swapButton,
            {
              backgroundColor: primarySurface,
              opacity: pressed ? Opacity.pressed : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t("exerciseList.swap")}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          <IconSymbol
            name="arrow.triangle.2.circlepath"
            size={14}
            color={primary}
          />
          <Text style={[Typography.micro, { color: primary }]}>
            {t("exerciseList.swap")}
          </Text>
        </Pressable>
      </View>

      {/* Sets table */}
      {isEditing ? (
        <EditSetsTable
          sets={exercise.sets}
          exerciseIndex={exerciseIndex}
          text={text}
          textMuted={textMuted}
          border={border}
          inputFill={inputFill}
          inputFillFocused={inputFillFocused}
          onUpdateSet={onUpdateSet}
          t={t}
        />
      ) : (
        <ReadSetsTable
          sets={exercise.sets}
          text={text}
          textSecondary={textSecondary}
          textMuted={textMuted}
          border={border}
          t={t}
        />
      )}

      {/* Notes */}
      {exercise.notes ? (
        <View style={[styles.notesRow, { borderTopColor: border }]}>
          <IconSymbol name="text.quote" size={12} color={textMuted} />
          <Text
            style={[Typography.caption, { color: textMuted }, styles.notesText]}
            numberOfLines={2}
          >
            {exercise.notes}
          </Text>
        </View>
      ) : null}

      <ReasoningDisclosure
        title={t("reasoning.exerciseTitle")}
        showLabel={t("reasoning.show")}
        hideLabel={t("reasoning.hide")}
        accessibilityLabel={t("reasoning.exerciseAccessibility", {
          exerciseName: displayName,
        })}
        entries={[
          {
            label: t("reasoning.muscleGroups"),
            text: exercise.reasoning?.muscle_groups,
          },
          {
            label: t("reasoning.exerciseSelection"),
            text: exercise.reasoning?.exercise_selection,
          },
        ]}
      />
    </View>
  );
}

// -----------------------------------------------------------------------------
// ReadSetsTable (view mode)
// -----------------------------------------------------------------------------

interface ReadSetsTableProps {
  sets: LocalSet[];
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: TFunction<any, any>;
}

function ReadSetsTable({
  sets,
  text,
  textSecondary,
  textMuted,
  border,
  t,
}: ReadSetsTableProps) {
  const { label: unitLabel, format } = useWeightUnit();

  return (
    <View style={styles.setsContainer}>
      {/* Column headers */}
      <View style={[styles.setColumnHeaders, { borderBottomColor: border }]}>
        <Text style={[Typography.label, { color: textMuted }, styles.colSet]}>
          SET
        </Text>
        <Text style={[Typography.label, { color: textMuted }, styles.colType]}>
          TYPE
        </Text>
        <Text style={[Typography.label, { color: textMuted }, styles.colData]}>
          {unitLabel.toUpperCase()}
        </Text>
        <Text style={[Typography.label, { color: textMuted }, styles.colData]}>
          REPS
        </Text>
      </View>
      {/* Rows */}
      {sets.map((set, i) => (
        <View
          key={i}
          style={[
            styles.setRow,
            i < sets.length - 1 && { borderBottomColor: border },
          ]}
        >
          <Text
            style={[
              Typography.caption,
              { color: textSecondary },
              styles.colSet,
            ]}
          >
            {i + 1}
          </Text>
          <Text
            style={[
              Typography.micro,
              {
                color: set.set_type === "warmup" ? textMuted : textSecondary,
              },
              styles.colType,
            ]}
            numberOfLines={1}
          >
            {set.set_type === "warmup"
              ? t("exerciseList.warmup")
              : t("exerciseList.working")}
          </Text>
          <Text
            style={[
              Typography.bodyMedium,
              { color: text },
              styles.colData,
              { fontVariant: ["tabular-nums"] },
            ]}
          >
            {set.target_load_kg ? format(set.target_load_kg) : "—"}
          </Text>
          <Text
            style={[
              Typography.bodyMedium,
              { color: text },
              styles.colData,
              { fontVariant: ["tabular-nums"] },
            ]}
          >
            {set.target_reps || "—"}
          </Text>
        </View>
      ))}
    </View>
  );
}

// -----------------------------------------------------------------------------
// EditSetsTable (edit mode)
// -----------------------------------------------------------------------------

interface EditSetsTableProps {
  sets: LocalSet[];
  exerciseIndex: number;
  text: string;
  textMuted: string;
  border: string;
  inputFill: string;
  inputFillFocused: string;
  onUpdateSet: (
    exIndex: number,
    setIndex: number,
    field: "target_load_kg" | "target_reps",
    value: string
  ) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: TFunction<any, any>;
}

function EditSetsTable({
  sets,
  exerciseIndex,
  text,
  textMuted,
  border,
  inputFill,
  inputFillFocused,
  onUpdateSet,
  t,
}: EditSetsTableProps) {
  const wu = useWeightUnit();
  return (
    <View style={styles.setsContainer}>
      {/* Column headers */}
      <View style={[styles.setColumnHeaders, { borderBottomColor: border }]}>
        <Text style={[Typography.label, { color: textMuted }, styles.colSet]}>
          SET
        </Text>
        <Text
          style={[Typography.label, { color: textMuted }, styles.colType]}
        />
        <Text style={[Typography.label, { color: textMuted }, styles.colData]}>
          {t("edit.kg", { unit: wu.label })}
        </Text>
        <Text style={[Typography.label, { color: textMuted }, styles.colData]}>
          {t("edit.reps")}
        </Text>
      </View>
      {/* Editable rows */}
      {sets.map((set, i) => (
        <EditSetRow
          key={i}
          setIndex={i}
          set={set}
          exerciseIndex={exerciseIndex}
          text={text}
          textMuted={textMuted}
          border={border}
          inputFill={inputFill}
          inputFillFocused={inputFillFocused}
          isLast={i === sets.length - 1}
          onUpdateSet={onUpdateSet}
        />
      ))}
    </View>
  );
}

interface EditSetRowProps {
  setIndex: number;
  set: LocalSet;
  exerciseIndex: number;
  text: string;
  textMuted: string;
  border: string;
  inputFill: string;
  inputFillFocused: string;
  isLast: boolean;
  onUpdateSet: (
    exIndex: number,
    setIndex: number,
    field: "target_load_kg" | "target_reps",
    value: string
  ) => void;
}

function EditSetRow({
  setIndex,
  set,
  exerciseIndex,
  text,
  textMuted,
  border,
  inputFill,
  inputFillFocused,
  isLast,
  onUpdateSet,
}: EditSetRowProps) {
  const wu = useWeightUnit();
  const [focusedField, setFocusedField] = useState<"kg" | "reps" | null>(null);

  return (
    <View style={[styles.setRow, !isLast && { borderBottomColor: border }]}>
      <Text style={[Typography.caption, { color: textMuted }, styles.colSet]}>
        {setIndex + 1}
      </Text>
      <View style={styles.colType}>
        <Text
          style={[
            Typography.micro,
            {
              color: set.set_type === "warmup" ? textMuted : text,
            },
          ]}
        >
          {set.set_type === "warmup" ? "W" : ""}
        </Text>
      </View>
      <View style={styles.colData}>
        <TextInput
          style={[
            styles.setInput,
            {
              backgroundColor:
                focusedField === "kg" ? inputFillFocused : inputFill,
              color: text,
              borderColor: focusedField === "kg" ? border : "transparent",
            },
          ]}
          value={set.target_load_kg ? String(set.target_load_kg) : ""}
          onChangeText={(v) =>
            onUpdateSet(exerciseIndex, setIndex, "target_load_kg", v)
          }
          onFocus={() => setFocusedField("kg")}
          onBlur={() => setFocusedField(null)}
          placeholder="—"
          placeholderTextColor={textMuted}
          keyboardType="number-pad"
          returnKeyType="done"
          maxLength={5}
          accessibilityLabel={`Weight in ${wu.label}`}
        />
      </View>
      <View style={styles.colData}>
        <TextInput
          style={[
            styles.setInput,
            {
              backgroundColor:
                focusedField === "reps" ? inputFillFocused : inputFill,
              color: text,
              borderColor: focusedField === "reps" ? border : "transparent",
            },
          ]}
          value={set.target_reps ? String(set.target_reps) : ""}
          onChangeText={(v) =>
            onUpdateSet(exerciseIndex, setIndex, "target_reps", v)
          }
          onFocus={() => setFocusedField("reps")}
          onBlur={() => setFocusedField(null)}
          placeholder="—"
          placeholderTextColor={textMuted}
          keyboardType="number-pad"
          returnKeyType="done"
          maxLength={4}
          accessibilityLabel="Reps"
        />
      </View>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: Radii.full,
  },
  exerciseList: {
    gap: Spacing.md,
  },
  statusCard: {
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: Spacing.lg,
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  regenerationStatusText: {
    marginBottom: Spacing.md,
    lineHeight: 17,
  },
  planReasoning: {
    marginBottom: Spacing.lg,
  },
  statusCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: Radii.full,
  },
  warmupCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: Spacing.lg,
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  warmupIcon: {
    width: 40,
    height: 40,
    borderRadius: Radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  warmupText: {
    flex: 1,
    gap: 2,
  },
  exerciseCard: {
    borderRadius: Radii.md,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  exerciseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  exerciseHeaderLeft: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  exerciseNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  exerciseMeta: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  swapButton: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: Radii.full,
  },
  // Sets table
  setsContainer: {
    borderRadius: Radii.sm,
    borderWidth: 0,
  },
  setColumnHeaders: {
    flexDirection: "row",
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    marginBottom: Spacing.xs,
  },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  colSet: {
    width: 32,
    textAlign: "center",
  },
  colType: {
    width: 76,
    textAlign: "center",
  },
  colData: {
    flex: 1,
    alignItems: "center",
  },
  setInput: {
    width: "100%",
    borderRadius: Radii.sm,
    borderWidth: 1.5,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    textAlign: "center",
    ...Typography.bodyMedium,
    fontVariant: ["tabular-nums"],
  },
  notesRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.xs,
    borderTopWidth: 1,
    paddingTop: Spacing.md,
    marginTop: Spacing.md,
  },
  notesText: {
    flex: 1,
    lineHeight: 16,
  },
  // Footer
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
  regenerationBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.42)",
    justifyContent: "flex-end",
  },
  regenerationSheet: {
    borderTopLeftRadius: Radii.lg,
    borderTopRightRadius: Radii.lg,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing["4xl"],
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: Radii.full,
    alignSelf: "center",
    marginBottom: Spacing.lg,
  },
  regenerationIcon: {
    width: 40,
    height: 40,
    borderRadius: Radii.sm,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  regenerationSheetCopy: {
    lineHeight: 18,
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  feedbackInput: {
    minHeight: 112,
    borderWidth: 1.5,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    ...Typography.body,
    lineHeight: 20,
  },
  regenerationActions: {
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  regenerationPrimaryAction: {
    minHeight: 50,
    borderRadius: Radii.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  regenerationPrimaryActionText: {
    color: "#FFFFFF",
  },
  regenerationSecondaryAction: {
    minHeight: 48,
    borderRadius: Radii.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  regenerationLimitNote: {
    textAlign: "center",
    marginTop: Spacing.md,
  },
  regenerateDisabled: {
    borderRadius: Radii.lg,
    paddingVertical: Spacing.lg,
    alignItems: "center",
  },
  bottomPadding: {
    height: Spacing.xl,
  },
});
