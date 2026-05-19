import { IconSymbol } from "@/components/ui/icon-symbol";
import { ExercisePreferenceSheet } from "@/components/exercise/exercise-preference-sheet";
import { ExerciseMenu } from "@/components/workout/exercise-menu";
import { ProgressionPill } from "@/components/workout/progression-pill";
import { SetHeader } from "@/components/workout/set-header";
import { SetRow } from "@/components/workout/set-row";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { useExercisePreference } from "@/hooks/use-exercise-preference-query";
import {
  useSetExercisePreference,
  useRemoveExercisePreference,
} from "@/hooks/use-exercise-preference-mutations";
import { useThemeColor } from "@/hooks/use-theme-color";
import type { WorkoutExercise } from "@/stores/workout-store";
import { useWorkoutStore } from "@/stores/workout-store";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

interface ExerciseCardProps {
  exercise: WorkoutExercise;
  displayName?: string;
}

export function ExerciseCard({ exercise, displayName }: ExerciseCardProps) {
  const { t } = useTranslation("workout");
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);
  const [prefSheetVisible, setPrefSheetVisible] = useState(false);

  const { data: preference } = useExercisePreference(exercise.id);
  const setPreferenceMutation = useSetExercisePreference();
  const removePreferenceMutation = useRemoveExercisePreference();

  const toggleSetComplete = useWorkoutStore((s) => s.toggleSetComplete);
  const updateSetField = useWorkoutStore((s) => s.updateSetField);
  const updateSetDuration = useWorkoutStore((s) => s.updateSetDuration);
  const updateSetRpe = useWorkoutStore((s) => s.updateSetRpe);
  const addSet = useWorkoutStore((s) => s.addSet);
  const removeSet = useWorkoutStore((s) => s.removeSet);
  const removeExercise = useWorkoutStore((s) => s.removeExercise);
  const updateNotes = useWorkoutStore((s) => s.updateNotes);

  const backgroundElevated = useThemeColor({}, "backgroundElevated");
  const border = useThemeColor({}, "border");
  const primary = useThemeColor({}, "primary");
  const textColor = useThemeColor({}, "text");
  const textMuted = useThemeColor({}, "textMuted");
  const inputFill = useThemeColor({}, "inputFill");
  const textSecondary = useThemeColor({}, "textSecondary");
  const exerciseName = displayName ?? exercise.name;

  const handleExercisePress = useCallback(() => {
    router.push({
      pathname: "/exercise-detail",
      params: { exerciseId: exercise.id },
    });
  }, [router, exercise.id]);

  const handleAddSet = useCallback(() => {
    addSet(exercise.id);
  }, [addSet, exercise.id]);

  const handleReplace = useCallback(() => {
    router.push({
      pathname: "/exercise-picker",
      params: { exerciseId: exercise.id },
    });
  }, [router, exercise.id]);

  const handleRemove = useCallback(() => {
    Alert.alert(
      t("removeExercise.confirmTitle"),
      t("removeExercise.confirmMessage", { exerciseName }),
      [
        { text: t("removeExercise.cancel"), style: "cancel" },
        {
          text: t("removeExercise.confirmRemove"),
          style: "destructive",
          onPress: () => removeExercise(exercise.id),
        },
      ]
    );
  }, [exercise.id, exerciseName, removeExercise, t]);

  const handleNotesChange = useCallback(
    (text: string) => {
      updateNotes(exercise.id, text);
    },
    [updateNotes, exercise.id]
  );

  const formatRestTime = (seconds: number): string => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    if (sec === 0) return `${min}min`;
    return `${min}min ${sec}s`;
  };

  // Track working set indices for display numbering
  let workingSetIndex = 0;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: backgroundElevated,
          borderColor: border,
        },
      ]}
    >
      {/* Exercise Header */}
      <View style={styles.header}>
        <View
          style={[styles.imagePlaceholder, { backgroundColor: inputFill }]}
        />
        <Pressable
          onPress={handleExercisePress}
          accessibilityRole="link"
          accessibilityLabel={exerciseName}
          style={styles.exerciseName}
        >
          <Text
            style={[Typography.titleSm, { color: primary }]}
            numberOfLines={1}
          >
            {exerciseName}
          </Text>
        </Pressable>
        <ProgressionPill type={exercise.progressionType} />
        <Pressable
          onPress={() => setMenuVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={`Options for ${exerciseName}`}
          hitSlop={8}
          style={styles.menuButton}
        >
          <IconSymbol name="ellipsis" size={20} color={textSecondary} />
        </Pressable>
      </View>

      {/* Notes */}
      <TextInput
        style={[styles.notesInput, { color: textColor }]}
        value={exercise.notes}
        onChangeText={handleNotesChange}
        placeholder={t("exercise.notesPlaceholder")}
        placeholderTextColor={textMuted}
        multiline
        accessibilityLabel={`Notes for ${exerciseName}`}
      />

      {/* Rest Timer Info */}
      <View style={styles.restTimerInfo}>
        <IconSymbol name="timer" size={16} color={primary} />
        <Text style={[Typography.caption, { color: primary }]}>
          {t("exercise.restTimer", {
            time: formatRestTime(exercise.restDurationSeconds),
          })}
        </Text>
      </View>

      {/* Set Table */}
      <SetHeader exerciseType={exercise.exerciseType ?? "weight"} />
      {exercise.sets.map((set) => {
        const currentWorkingIndex =
          set.type === "working" ? workingSetIndex++ : 0;
        return (
          <SetRow
            key={set.id}
            set={set}
            setIndex={currentWorkingIndex}
            exerciseId={exercise.id}
            exerciseType={exercise.exerciseType ?? "weight"}
            onToggleComplete={() => toggleSetComplete(exercise.id, set.id)}
            onUpdateField={(field, value) =>
              updateSetField(exercise.id, set.id, field, value)
            }
            onUpdateDuration={(seconds) =>
              updateSetDuration(exercise.id, set.id, seconds)
            }
            onUpdateRpe={(rpe) => updateSetRpe(exercise.id, set.id, rpe)}
            onRemove={() => removeSet(exercise.id, set.id)}
          />
        );
      })}

      {/* Add Set */}
      <Pressable
        onPress={handleAddSet}
        accessibilityRole="button"
        accessibilityLabel={t("exercise.addSet")}
        style={styles.addSetButton}
      >
        <Text style={[Typography.bodyMedium, { color: primary }]}>
          {t("exercise.addSet")}
        </Text>
      </Pressable>

      {/* Exercise Menu */}
      <ExerciseMenu
        visible={menuVisible}
        exerciseName={exerciseName}
        currentPreference={preference ?? null}
        onClose={() => setMenuVisible(false)}
        onReplace={handleReplace}
        onRemove={handleRemove}
        onPreferenceSelect={() => setPrefSheetVisible(true)}
      />

      {/* Exercise Preference Sheet */}
      <ExercisePreferenceSheet
        visible={prefSheetVisible}
        exerciseName={exerciseName}
        currentPreference={preference ?? null}
        onClose={() => setPrefSheetVisible(false)}
        onSelect={(pref) => {
          if (pref === null) {
            removePreferenceMutation.mutate(exercise.id);
          } else {
            setPreferenceMutation.mutate({
              exerciseId: exercise.id,
              preference: pref,
            });
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Radii.md,
    borderWidth: 1,
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  imagePlaceholder: {
    width: 44,
    height: 44,
    borderRadius: Radii.sm,
  },
  exerciseName: {
    flex: 1,
  },
  menuButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  notesInput: {
    paddingHorizontal: Spacing.md,
    ...Typography.caption,
    minHeight: 28,
  },
  restTimerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  addSetButton: {
    alignItems: "center",
    paddingVertical: Spacing.md,
    marginTop: Spacing.xs,
  },
});
