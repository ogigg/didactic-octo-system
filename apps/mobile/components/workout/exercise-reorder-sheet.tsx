import { ExerciseImage } from "@/components/exercise/exercise-image";
import {
  AppBottomSheet,
  type AppBottomSheetHandle,
} from "@/components/ui/app-bottom-sheet";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Opacity, Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import type { ExerciseImageData } from "@/lib/exercise-media";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  LayoutAnimation,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { PanGestureHandler, State } from "react-native-gesture-handler";
import { useTranslation } from "react-i18next";

const ROW_STRIDE = 72;

export function getExerciseReorderTargetIndex(
  currentIndex: number,
  total: number,
  translationY: number
): number {
  return Math.max(
    0,
    Math.min(total - 1, currentIndex + Math.round(translationY / ROW_STRIDE))
  );
}

export interface ExerciseOrderItem {
  id: string;
  name: string;
  image?: ExerciseImageData | null;
}

interface DraggableExerciseRowProps {
  exercise: ExerciseOrderItem;
  index: number;
  total: number;
  isHighlighted: boolean;
  onMove: (exerciseId: string, targetIndex: number) => void;
}

function DraggableExerciseRow({
  exercise,
  index,
  total,
  isHighlighted,
  onMove,
}: DraggableExerciseRowProps) {
  const { t } = useTranslation("workout");
  const translateY = useRef(new Animated.Value(0)).current;
  const [isDragging, setIsDragging] = useState(false);
  const background = useThemeColor({}, "backgroundElevated");
  const primarySurface = useThemeColor({}, "primarySurface");
  const border = useThemeColor({}, "border");
  const textColor = useThemeColor({}, "text");
  const textMuted = useThemeColor({}, "textMuted");
  const textSecondary = useThemeColor({}, "textSecondary");

  const move = useCallback(
    (targetIndex: number) => {
      const boundedIndex = Math.max(0, Math.min(total - 1, targetIndex));
      if (boundedIndex === index) return;
      void Haptics.selectionAsync().catch(() => {});
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      onMove(exercise.id, boundedIndex);
    },
    [exercise.id, index, onMove, total]
  );

  const onGestureEvent = useCallback(
    (event: { nativeEvent: { translationY: number } }) => {
      const minTranslation = -index * ROW_STRIDE;
      const maxTranslation = (total - index - 1) * ROW_STRIDE;
      translateY.setValue(
        Math.max(
          minTranslation,
          Math.min(maxTranslation, event.nativeEvent.translationY)
        )
      );
    },
    [index, total, translateY]
  );

  const onHandlerStateChange = useCallback(
    (event: { nativeEvent: { state: number; translationY: number } }) => {
      const { state, translationY: offset } = event.nativeEvent;
      if (state === State.ACTIVE) {
        setIsDragging(true);
        return;
      }

      if (
        state === State.END ||
        state === State.CANCELLED ||
        state === State.FAILED
      ) {
        const targetIndex =
          state === State.END
            ? getExerciseReorderTargetIndex(index, total, offset)
            : index;
        translateY.setValue(0);
        setIsDragging(false);
        move(targetIndex);
      }
    },
    [index, move, total, translateY]
  );

  return (
    <Animated.View
      style={[
        styles.row,
        {
          backgroundColor: isHighlighted ? primarySurface : background,
          borderColor: border,
          transform: [{ translateY }],
          zIndex: isDragging ? 2 : 0,
          elevation: isDragging ? 6 : 0,
        },
        isDragging && styles.draggingRow,
      ]}
      accessibilityLabel={`${exercise.name}, ${t("menu.position", {
        position: index + 1,
        total,
      })}`}
    >
      <Text style={[Typography.caption, styles.position, { color: textMuted }]}>
        {index + 1}
      </Text>
      <ExerciseImage
        image={exercise.image ?? null}
        exerciseName={exercise.name}
        size="thumbnail"
      />
      <View style={styles.exerciseText}>
        <Text
          style={[Typography.titleSm, { color: textColor }]}
          numberOfLines={1}
        >
          {exercise.name}
        </Text>
        <Text style={[Typography.caption, { color: textMuted }]}>
          {t("menu.position", { position: index + 1, total })}
        </Text>
      </View>
      <View style={styles.accessibleActions}>
        <Pressable
          onPress={() => move(index - 1)}
          disabled={index === 0}
          accessibilityRole="button"
          accessibilityLabel={t("menu.moveExerciseEarlier", {
            exerciseName: exercise.name,
          })}
          accessibilityState={{ disabled: index === 0 }}
          hitSlop={4}
          style={[styles.smallAction, index === 0 && styles.disabled]}
        >
          <IconSymbol name="arrow.up" size={17} color={textSecondary} />
        </Pressable>
        <Pressable
          onPress={() => move(index + 1)}
          disabled={index === total - 1}
          accessibilityRole="button"
          accessibilityLabel={t("menu.moveExerciseLater", {
            exerciseName: exercise.name,
          })}
          accessibilityState={{ disabled: index === total - 1 }}
          hitSlop={4}
          style={[styles.smallAction, index === total - 1 && styles.disabled]}
        >
          <IconSymbol name="arrow.down" size={17} color={textSecondary} />
        </Pressable>
      </View>
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
        activeOffsetY={[-6, 6]}
        failOffsetX={[-16, 16]}
      >
        <Animated.View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={t("menu.dragExercise", {
            exerciseName: exercise.name,
          })}
          style={styles.dragHandle}
        >
          <IconSymbol name="line.3.horizontal" size={22} color={textMuted} />
        </Animated.View>
      </PanGestureHandler>
    </Animated.View>
  );
}

interface ExerciseReorderSheetProps {
  visible: boolean;
  exercises: ExerciseOrderItem[];
  highlightedExerciseId: string | null;
  onMove: (exerciseId: string, targetIndex: number) => void;
  onClose: () => void;
}

export function ExerciseReorderSheet({
  visible,
  exercises,
  highlightedExerciseId,
  onMove,
  onClose,
}: ExerciseReorderSheetProps) {
  const { t } = useTranslation("workout");
  const sheetRef = useRef<AppBottomSheetHandle>(null);
  const scrollRef = useRef<ScrollView>(null);
  const textColor = useThemeColor({}, "text");
  const textMuted = useThemeColor({}, "textMuted");
  const primary = useThemeColor({}, "primary");

  useEffect(() => {
    if (!visible || !highlightedExerciseId) return;
    const index = exercises.findIndex(
      (exercise) => exercise.id === highlightedExerciseId
    );
    if (index < 0) return;

    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, index * ROW_STRIDE - ROW_STRIDE),
        animated: true,
      });
    }, 280);
    return () => clearTimeout(timer);
  }, [exercises, highlightedExerciseId, visible]);

  return (
    <AppBottomSheet
      ref={sheetRef}
      visible={visible}
      onClose={onClose}
      closeAccessibilityLabel={t("menu.closeReorder")}
      testID="exercise-reorder-sheet"
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[Typography.titleMd, { color: textColor }]}>
            {t("menu.reorderTitle")}
          </Text>
          <Text style={[Typography.caption, { color: textMuted }]}>
            {t("menu.reorderHint")}
          </Text>
        </View>
        <Pressable
          onPress={() => sheetRef.current?.dismiss()}
          accessibilityRole="button"
          accessibilityLabel={t("menu.done")}
          style={styles.doneButton}
        >
          <Text style={[Typography.titleSm, { color: primary }]}>
            {t("menu.done")}
          </Text>
        </Pressable>
      </View>
      <ScrollView
        ref={scrollRef}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {exercises.map((exercise, index) => (
          <DraggableExerciseRow
            key={exercise.id}
            exercise={exercise}
            index={index}
            total={exercises.length}
            isHighlighted={exercise.id === highlightedExerciseId}
            onMove={onMove}
          />
        ))}
      </ScrollView>
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  headerText: {
    flex: 1,
    gap: Spacing.xs,
  },
  doneButton: {
    minWidth: 48,
    minHeight: 40,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  list: {
    maxHeight: 480,
  },
  listContent: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  row: {
    height: ROW_STRIDE - Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.sm,
  },
  draggingRow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
  },
  position: {
    width: 18,
    textAlign: "center",
  },
  exerciseText: {
    flex: 1,
    gap: 2,
  },
  accessibleActions: {
    flexDirection: "row",
    gap: 2,
  },
  smallAction: {
    width: 30,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: {
    opacity: Opacity.disabled,
  },
  dragHandle: {
    width: 36,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
