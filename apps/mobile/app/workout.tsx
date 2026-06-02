import { WorkoutTopBar } from "@/components/workout/workout-top-bar";
import { WorkoutTimer } from "@/components/workout/workout-timer";
import { ExerciseCard } from "@/components/workout/exercise-card";
import { RestTimerBar } from "@/components/workout/rest-timer-bar";
import { useWorkoutStore } from "@/stores/workout-store";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useWorkoutLiveActivity } from "@/hooks/use-workout-live-activity";
import { useWatchBridge } from "@/hooks/use-watch-bridge";
import { useLocalizedExerciseMap } from "@/hooks/use-exercises-query";
import {
  countLoggedWorkoutSets,
  hasLoggedWorkoutData,
} from "@/lib/workout-session-state";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef } from "react";
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
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useTranslation } from "react-i18next";

export default function WorkoutScreen() {
  const { t } = useTranslation("workout");
  const router = useRouter();

  // iOS Live Activity / Dynamic Island
  useWorkoutLiveActivity();
  // Apple Watch companion sync
  useWatchBridge();

  const exercises = useWorkoutStore((s) => s.exercises);
  const workoutName = useWorkoutStore((s) => s.workoutName);
  const finishWorkout = useWorkoutStore((s) => s.finishWorkout);
  const clearWorkout = useWorkoutStore((s) => s.clearWorkout);
  const updateWorkoutName = useWorkoutStore((s) => s.updateWorkoutName);
  const background = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const primary = useThemeColor({}, "primary");
  const progressTrack = useThemeColor({}, "inputFill");
  const scrollRef = useRef<ScrollView>(null);
  const exerciseLayouts = useRef<Record<string, number>>({});
  const exerciseIds = useMemo(() => exercises.map((ex) => ex.id), [exercises]);
  const { exerciseMap } = useLocalizedExerciseMap(exerciseIds);

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
  const progressRatio = totalSets > 0 ? completedSets / totalSets : 0;
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

    if (!hasLoggedWorkoutData(exercises)) {
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

    const incompleteSets = totalSets - completedSets;
    if (incompleteSets > 0) {
      Alert.alert(
        t("finish.confirmTitle"),
        incompleteSets === 1
          ? t("finish.confirmMessage", { count: incompleteSets })
          : t("finish.confirmMessage_plural", { count: incompleteSets }),
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
    totalSets,
    completedSets,
    clearWorkout,
    finishWorkout,
    router,
    t,
  ]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={[styles.root, { backgroundColor: background }]}>
        <SafeAreaProvider>
          <SafeAreaView style={styles.safe}>
            <WorkoutTopBar
              workoutName={workoutName}
              completedSets={completedSets}
              totalSets={totalSets}
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
                  max: totalSets,
                  now: completedSets,
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
                {exercises.length === 0 ? (
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
                    {exercises.map((exercise) => (
                      <View
                        key={exercise.id}
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
                            exerciseMap.get(exercise.id)?.name ?? exercise.name
                          }
                          image={
                            exercise.image ??
                            exerciseMap.get(exercise.id)?.image
                          }
                        />
                      </View>
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
        </SafeAreaProvider>
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
