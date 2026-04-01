import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Opacity, Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import {
  useRegenerateWorkout,
  useStartPendingWorkout,
} from "@/hooks/use-workout-queue";
import type { PendingWorkout } from "@/lib/api/pending-workouts";
import { usePendingSwapStore } from "@/stores/pending-swap-store";
import {
  selectNextWorkout,
  usePendingWorkoutStore,
} from "@/stores/pending-workout-store";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface LocalExercise {
  exercise_id: string;
  exercise_name: string;
  rest_duration_seconds: number;
  notes: string | null;
  sets: LocalSet[];
}

interface LocalSet {
  set_type: "warmup" | "working";
  target_load_kg: number;
  target_reps: number;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function estimateMinutes(exercises: LocalExercise[]): number {
  const totalSets = exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
  const avgRest =
    exercises.length > 0 ? exercises[0].rest_duration_seconds : 90;
  return Math.round((totalSets * 45 + (totalSets - 1) * avgRest) / 60);
}

function canRegenerateToday(workout: PendingWorkout): boolean {
  if (!workout.last_regenerated_at) return true;
  const last = new Date(workout.last_regenerated_at);
  const now = new Date();
  return (
    last.getFullYear() !== now.getFullYear() ||
    last.getMonth() !== now.getMonth() ||
    last.getDate() !== now.getDate()
  );
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
  const success = useThemeColor({}, "success");

  // Store
  const queue = usePendingWorkoutStore((s) => s.queue);
  const nextWorkout = selectNextWorkout(queue);
  const workout = queue.find((w) => w.id === id) ?? null;
  const isNextUp = nextWorkout?.id === id;

  // Mutations
  const startMutation = useStartPendingWorkout();
  const regenerateMutation = useRegenerateWorkout();

  // Local edit state
  const [isEditing, setIsEditing] = useState(false);
  const [localExercises, setLocalExercises] = useState<LocalExercise[]>([]);
  const swapIndexRef = useRef<number | null>(null);
  const swapResult = usePendingSwapStore((s) => s.result);
  const setSwapResult = usePendingSwapStore((s) => s.setResult);

  // Initialize local exercises from workout data
  useEffect(() => {
    if (workout?.workout_data) {
      setLocalExercises(
        workout.workout_data.exercises.map((ex) => ({
          exercise_id: ex.exercise_id,
          exercise_name: ex.exercise_name,
          rest_duration_seconds: ex.rest_duration_seconds,
          notes: ex.notes,
          sets: ex.sets.map((s) => ({
            set_type: s.set_type,
            target_load_kg: s.target_load_kg,
            target_reps: s.target_reps,
          })),
        }))
      );
    }
  }, [workout?.workout_data]);

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
                }
              : ex
          )
        );
        swapIndexRef.current = null;
        setSwapResult(null);
      }
    }, [swapResult, setSwapResult])
  );

  // Handlers
  const handleStart = useCallback(() => {
    if (!workout) return;
    startMutation.mutate(workout);
  }, [workout, startMutation]);

  const handleRegenerate = useCallback(() => {
    if (!workout) return;
    Alert.alert(t("regenerate.confirmTitle"), t("regenerate.confirmMessage"), [
      { text: t("regenerate.cancel"), style: "cancel" },
      {
        text: t("regenerate.confirm"),
        style: "destructive",
        onPress: () => regenerateMutation.mutate(workout.id),
      },
    ]);
  }, [workout, regenerateMutation, t]);

  const handleSwap = useCallback(
    (exerciseIndex: number) => {
      swapIndexRef.current = exerciseIndex;
      setSwapResult(null);
      router.push("/exercise-picker?mode=pending_swap" as never);
    },
    [router, setSwapResult]
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
    []
  );

  // Loading / empty states
  if (!workout || !workout.workout_data) {
    return (
      <View style={[styles.root, { backgroundColor: background }]}>
        <SafeAreaView style={styles.safe}>
          <View style={[styles.header, { borderBottomColor: border }]}>
            <BackButton />
            <View style={styles.headerSpacer} />
          </View>
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
      </View>
    );
  }

  const estimatedMinutes = estimateMinutes(localExercises);
  const regenerable = canRegenerateToday(workout);

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: border }]}>
          <BackButton />
          <Text style={[Typography.titleMd, { color: text }]} numberOfLines={1}>
            {workout.workout_data.workout_name}
          </Text>
          <Pressable
            onPress={() => setIsEditing((prev) => !prev)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={isEditing ? t("edit.done") : t("edit.toggle")}
          >
            <Text style={[Typography.bodyMedium, { color: primary }]}>
              {isEditing ? t("edit.done") : t("edit.toggle")}
            </Text>
          </Pressable>
        </View>

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
              <View style={[styles.badge, { backgroundColor: primarySurface }]}>
                <Text style={[Typography.caption, { color: primary }]}>
                  {workout.focus_area
                    .replace("_", " ")
                    .replace(/\b\w/g, (c) => c.toUpperCase())}
                </Text>
              </View>
            )}
            <View style={[styles.badge, { backgroundColor: primaryContainer }]}>
              <IconSymbol name="clock" size={12} color={primary} />
              <Text style={[Typography.caption, { color: primary }]}>
                {t("meta.duration", { minutes: estimatedMinutes })}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: primaryContainer }]}>
              <IconSymbol name="dumbbell" size={12} color={primary} />
              <Text style={[Typography.caption, { color: primary }]}>
                {t("meta.exercises", {
                  count: localExercises.length,
                })}
              </Text>
            </View>
          </View>

          {/* Exercise list */}
          <View style={styles.exerciseList}>
            {localExercises.map((exercise, exIndex) => (
              <ExerciseCard
                key={`${exercise.exercise_id}-${exIndex}`}
                exercise={exercise}
                exerciseIndex={exIndex}
                isEditing={isEditing}
                text={text}
                textSecondary={textSecondary}
                textMuted={textMuted}
                textDisabled={textDisabled}
                border={border}
                backgroundElevated={backgroundElevated}
                inputFill={inputFill}
                inputFillFocused={inputFillFocused}
                primary={primary}
                primarySurface={primarySurface}
                onUpdateSet={handleUpdateSet}
                onSwap={handleSwap}
                t={t}
              />
            ))}
          </View>

          <View style={styles.bottomPadding} />
        </ScrollView>

        {/* Footer actions */}
        <View style={[styles.footer, { backgroundColor: background }]}>
          {isNextUp && (
            <Button
              label={t("actions.startWorkout")}
              onPress={handleStart}
              accessibilityLabel={t("actions.startWorkout")}
            />
          )}
          {!isNextUp && <View style={styles.footerSpacer} />}
          {regenerateMutation.isPending ? (
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
          ) : (
            <View
              style={[
                styles.regenerateDisabled,
                { backgroundColor: primaryContainer },
              ]}
            >
              <Text style={[Typography.caption, { color: textMuted }]}>
                {t("actions.regeneratedToday")}
              </Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

// -----------------------------------------------------------------------------
// ExerciseCard
// -----------------------------------------------------------------------------

interface ExerciseCardProps {
  exercise: LocalExercise;
  exerciseIndex: number;
  isEditing: boolean;
  text: string;
  textSecondary: string;
  textMuted: string;
  textDisabled: string;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: TFunction<any, any>;
}

function ExerciseCard({
  exercise,
  exerciseIndex,
  isEditing,
  text,
  textSecondary,
  textMuted,
  textDisabled,
  border,
  backgroundElevated,
  inputFill,
  inputFillFocused,
  primary,
  primarySurface,
  onUpdateSet,
  onSwap,
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
        <View style={styles.exerciseHeaderLeft}>
          <Text style={[Typography.titleSm, { color: text }]} numberOfLines={1}>
            {exercise.exercise_name}
          </Text>
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
          KG
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
            {set.target_load_kg || "—"}
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
          {t("edit.kg")}
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
          accessibilityLabel="Weight in kg"
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  headerSpacer: { width: 60 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing["3xl"],
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
  exerciseCard: {
    borderRadius: Radii.md,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  exerciseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  exerciseHeaderLeft: {
    flex: 1,
    gap: 2,
  },
  exerciseMeta: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  swapButton: {
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
    width: 52,
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
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
  footerSpacer: {
    height: 0,
  },
  regenerateDisabled: {
    borderRadius: Radii.lg,
    paddingVertical: Spacing.lg,
    alignItems: "center",
  },
  bottomPadding: {
    height: Spacing["2xl"],
  },
});
