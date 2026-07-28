import { ExerciseCard } from "@/components/workout/exercise-card";
import {
  ExerciseReorderSheet,
  type ExerciseOrderItem,
} from "@/components/workout/exercise-reorder-sheet";
import { CelebrationProvider } from "@/components/workout/celebration/celebration-provider";
import { ReasoningDisclosure } from "@/components/workout/reasoning-disclosure";
import { RestTimerBar } from "@/components/workout/rest-timer-bar";
import { WarmupCard } from "@/components/workout/warmup-card";
import { WorkoutTimer } from "@/components/workout/workout-timer";
import { WorkoutTopBar } from "@/components/workout/workout-top-bar";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { useLocalizedExerciseMap } from "@/hooks/use-exercises-query";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useWatchBridge } from "@/hooks/use-watch-bridge";
import { useWorkoutLiveActivity } from "@/hooks/use-workout-live-activity";
import {
  countLoggedWorkoutSets,
  hasLoggedWorkoutData,
} from "@/lib/workout-session-state";
import { useWorkoutStore } from "@/stores/workout-store";
import { useKeepAwake } from "expo-keep-awake";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Animated,
  Easing,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Reanimated, { LinearTransition } from "react-native-reanimated";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

const EXERCISE_LAYOUT_TRANSITION = LinearTransition.springify()
  .damping(24)
  .stiffness(220);

export default function WorkoutScreen() {
  const { t } = useTranslation("workout");
  const router = useRouter();

  // iOS Live Activity / Dynamic Island
  useWorkoutLiveActivity();
  // Apple Watch companion sync
  useWatchBridge();
  // Keep the phone display awake while the active workout screen is open.
  useKeepAwake();

  const exercises = useWorkoutStore((s) => s.exercises);
  const warmup = useWorkoutStore((s) => s.warmup);
  const workoutName = useWorkoutStore((s) => s.workoutName);
  const generationMeta = useWorkoutStore((s) => s.generationMeta);
  const finishWorkout = useWorkoutStore((s) => s.finishWorkout);
  const clearWorkout = useWorkoutStore((s) => s.clearWorkout);
  const reorderExercise = useWorkoutStore((s) => s.reorderExercise);
  const updateWorkoutName = useWorkoutStore((s) => s.updateWorkoutName);
  const background = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const primary = useThemeColor({}, "primary");
  const progressTrack = useThemeColor({}, "inputFill");
  const scrollRef = useRef<ScrollView>(null);
  const exerciseLayouts = useRef<Record<string, number>>({});
  const reorderedExerciseRef = useRef<string | null>(null);
  const [reorderExerciseId, setReorderExerciseId] = useState<string | null>(
    null
  );
  const exerciseIds = useMemo(() => exercises.map((ex) => ex.id), [exercises]);
  const { exerciseMap } = useLocalizedExerciseMap(exerciseIds);
  const exerciseOrderItems = useMemo<ExerciseOrderItem[]>(
    () =>
      exercises.map((exercise) => ({
        id: exercise.id,
        name: exerciseMap.get(exercise.id)?.name ?? exercise.name,
        image: exercise.image ?? exerciseMap.get(exercise.id)?.image ?? null,
      })),
    [exerciseMap, exercises]
  );

  const { completedSets, totalSets } = useMemo(() => {
    let completed = 0;
    let total = 0;
    for (const ex of exercises) {
      for (const set of ex.sets) {
        total++;
        if (set.isCompleted) completed++;
      }
    }
    return { completedSets: completed, totalSets: total };
  }, [exercises]);
  const completedSteps = completedSets + (warmup?.isCompleted ? 1 : 0);
  const totalSteps = totalSets + (warmup ? 1 : 0);
  const progressRatio = totalSteps > 0 ? completedSteps / totalSteps : 0;
  const animatedProgress = useRef(new Animated.Value(progressRatio)).current;

  useEffect(() => {
    Animated.timing(animatedProgress, {
      toValue: progressRatio,
      duration: 300,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [animatedProgress, progressRatio]);

  // Scroll to first exercise with incomplete sets on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (warmup && !warmup.isCompleted) return;

      const firstIncomplete = exercises.find((ex) =>
        ex.sets.some((s) => !s.isCompleted)
      );
      if (firstIncomplete) {
        const yOffset = exerciseLayouts.current[firstIncomplete.id];
        if (yOffset !== undefined && yOffset > 0) {
          scrollRef.current?.scrollTo({ y: yOffset, animated: true });
        }
      }
    }, 300);
    return () => clearTimeout(timer);
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExerciseLayout = useCallback((exerciseId: string, y: number) => {
    exerciseLayouts.current[exerciseId] = y;
  }, []);

  const handleAddExercise = useCallback(() => {
    router.push({ pathname: "/exercise-picker", params: { mode: "add" } });
  }, [router]);

  const handleMoveExercise = useCallback(
    (exerciseId: string, targetIndex: number) => {
      reorderedExerciseRef.current = exerciseId;
      reorderExercise(exerciseId, targetIndex);
    },
    [reorderExercise]
  );

  const handleCloseReorder = useCallback(() => {
    const exerciseId =
      reorderedExerciseRef.current ?? reorderExerciseId ?? null;
    setReorderExerciseId(null);

    if (!exerciseId) return;
    setTimeout(() => {
      const yOffset = exerciseLayouts.current[exerciseId];
      if (yOffset !== undefined) {
        scrollRef.current?.scrollTo({
          y: Math.max(0, yOffset - Spacing.lg),
          animated: true,
        });
      }
      reorderedExerciseRef.current = null;
    }, 100);
  }, [reorderExerciseId]);

  const handleDismiss = useCallback(() => {
    router.back();
  }, [router]);

  const handleFinish = useCallback(() => {
    const discardWorkout = () => {
      clearWorkout();
      router.replace("/(tabs)");
    };
    const confirmDiscardWorkout = () => {
      const loggedSets = countLoggedWorkoutSets(exercises);
      Alert.alert(
        t("finish.discardLoggedTitle"),
        loggedSets === 1
          ? t("finish.discardLoggedMessage", { count: loggedSets })
          : t("finish.discardLoggedMessage_plural", { count: loggedSets }),
        [
          { text: t("finish.cancel"), style: "cancel" },
          {
            text: t("finish.confirmDiscard"),
            style: "destructive",
            onPress: discardWorkout,
          },
        ]
      );
    };
    const finishAndSaveWorkout = () => {
      finishWorkout();
      router.push("/workout-summary");
    };

    if (!hasLoggedWorkoutData(exercises, warmup)) {
      Alert.alert(t("finish.emptyTitle"), t("finish.emptyMessage"), [
        { text: t("finish.cancel"), style: "cancel" },
        {
          text: t("finish.confirmDiscard"),
          style: "destructive",
          isPreferred: true,
          onPress: discardWorkout,
        },
        {
          text: t("finish.confirmFinish"),
          onPress: finishAndSaveWorkout,
        },
      ]);
      return;
    }

    const incompleteSteps = totalSteps - completedSteps;
    if (incompleteSteps > 0) {
      Alert.alert(
        t("finish.confirmTitle"),
        incompleteSteps === 1
          ? t("finish.confirmMessage", { count: incompleteSteps })
          : t("finish.confirmMessage_plural", { count: incompleteSteps }),
        [
          { text: t("finish.cancel"), style: "cancel" },
          {
            text: t("finish.confirmDiscard"),
            style: "destructive",
            onPress: confirmDiscardWorkout,
          },
          {
            text: t("finish.confirmFinish"),
            isPreferred: true,
            onPress: finishAndSaveWorkout,
          },
        ]
      );
    } else {
      Alert.alert(t("finish.completeTitle"), t("finish.completeMessage"), [
        { text: t("finish.cancel"), style: "cancel" },
        {
          text: t("finish.confirmDiscard"),
          style: "destructive",
          onPress: confirmDiscardWorkout,
        },
        {
          text: t("finish.confirmFinish"),
          isPreferred: true,
          onPress: finishAndSaveWorkout,
        },
      ]);
    }
  }, [
    exercises,
    totalSteps,
    completedSteps,
    warmup,
    clearWorkout,
    finishWorkout,
    router,
    t,
  ]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={[styles.root, { backgroundColor: background }]}>
        <CelebrationProvider>
          <SafeAreaProvider>
            <SafeAreaView style={styles.safe}>
              <WorkoutTopBar
                workoutName={workoutName}
                completedSteps={completedSteps}
                totalSteps={totalSteps}
                hasWarmup={warmup !== null}
                onDismiss={handleDismiss}
                onFinish={handleFinish}
                onWorkoutNameChange={updateWorkoutName}
              />
              <View style={styles.progressBarContainer}>
                <View
                  style={[
                    styles.progressTrack,
                    { backgroundColor: progressTrack },
                  ]}
                  accessibilityRole="progressbar"
                  accessibilityValue={{
                    min: 0,
                    max: totalSteps,
                    now: completedSteps,
                  }}
                >
                  <Animated.View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: primary,
                        width: animatedProgress.interpolate({
                          inputRange: [0, 1],
                          outputRange: ["0%", "100%"],
                        }),
                      },
                    ]}
                  />
                </View>
              </View>
              <WorkoutTimer />
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <ScrollView
                  ref={scrollRef}
                  contentContainerStyle={styles.scroll}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {exercises.length === 0 && !warmup ? (
                    <View style={styles.emptyState}>
                      <Text style={[Typography.titleMd, { color: textColor }]}>
                        {t("emptyState.title")}
                      </Text>
                      <Text
                        style={[
                          Typography.body,
                          { color: textSecondary },
                          styles.emptyStateSubtitle,
                        ]}
                      >
                        {t("emptyState.subtitle")}
                      </Text>
                      <TouchableOpacity
                        style={[
                          styles.addExerciseButtonLarge,
                          { backgroundColor: primary },
                        ]}
                        onPress={handleAddExercise}
                        accessibilityRole="button"
                        accessibilityLabel={t("emptyState.addExercise")}
                      >
                        <Text
                          style={[
                            Typography.titleSm,
                            styles.addExerciseButtonText,
                          ]}
                        >
                          {t("emptyState.addExercise")}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      <ReasoningDisclosure
                        title={t("reasoning.planTitle")}
                        showLabel={t("reasoning.show")}
                        hideLabel={t("reasoning.hide")}
                        accessibilityLabel={t("reasoning.planAccessibility")}
                        entries={[
                          {
                            label: t("reasoning.muscleGroups"),
                            text: generationMeta?.reasoning?.muscle_groups,
                          },
                          {
                            label: t("reasoning.trainingStrategy"),
                            text: generationMeta?.reasoning?.training_strategy,
                          },
                        ]}
                      />
                      <WarmupCard />
                      {exercises.map((exercise) => (
                        <Reanimated.View
                          key={exercise.id}
                          layout={EXERCISE_LAYOUT_TRANSITION}
                          onLayout={(e) =>
                            handleExerciseLayout(
                              exercise.id,
                              e.nativeEvent.layout.y
                            )
                          }
                        >
                          <ExerciseCard
                            exercise={exercise}
                            displayName={
                              exerciseMap.get(exercise.id)?.name ??
                              exercise.name
                            }
                            image={
                              exercise.image ??
                              exerciseMap.get(exercise.id)?.image
                            }
                            onReorder={setReorderExerciseId}
                          />
                        </Reanimated.View>
                      ))}
                      <TouchableOpacity
                        style={[
                          styles.addExerciseButton,
                          { borderColor: primary },
                        ]}
                        onPress={handleAddExercise}
                        accessibilityRole="button"
                        accessibilityLabel={t("addExercise")}
                      >
                        <Text style={[Typography.titleSm, { color: primary }]}>
                          {t("addExercise")}
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </ScrollView>
              </TouchableWithoutFeedback>
              <RestTimerBar />
            </SafeAreaView>
            <ExerciseReorderSheet
              visible={reorderExerciseId !== null}
              exercises={exerciseOrderItems}
              highlightedExerciseId={reorderExerciseId}
              onMove={handleMoveExercise}
              onClose={handleCloseReorder}
            />
          </SafeAreaProvider>
        </CelebrationProvider>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing["5xl"],
    gap: Spacing["2xl"],
  },
  progressBarContainer: {
    paddingBottom: Spacing.sm,
  },
  progressTrack: {
    height: 5,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing["5xl"],
    gap: Spacing.md,
  },
  emptyStateSubtitle: {
    textAlign: "center",
  },
  addExerciseButtonLarge: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing["3xl"],
    paddingVertical: Spacing.lg,
    borderRadius: Radii.lg,
    alignItems: "center",
  },
  addExerciseButtonText: {
    color: "#FFFFFF",
  },
  addExerciseButton: {
    borderWidth: 1,
    borderRadius: Radii.lg,
    paddingVertical: Spacing.lg,
    alignItems: "center",
    marginTop: Spacing.md,
  },
});
