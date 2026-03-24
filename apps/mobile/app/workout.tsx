import { WorkoutTopBar } from "@/components/workout/workout-top-bar";
import { WorkoutTimer } from "@/components/workout/workout-timer";
import { ExerciseCard } from "@/components/workout/exercise-card";
import { RestTimerBar } from "@/components/workout/rest-timer-bar";
import { useWorkoutStore } from "@/stores/workout-store";
import { useThemeColor } from "@/hooks/use-theme-color";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Alert,
  Animated,
  Easing,
  Keyboard,
  ScrollView,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useTranslation } from "react-i18next";

export default function WorkoutScreen() {
  const { t } = useTranslation("workout");
  const router = useRouter();
  const exercises = useWorkoutStore((s) => s.exercises);
  const workoutName = useWorkoutStore((s) => s.workoutName);
  const finishWorkout = useWorkoutStore((s) => s.finishWorkout);
  const updateWorkoutName = useWorkoutStore((s) => s.updateWorkoutName);
  const background = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const primary = useThemeColor({}, "primary");
  const progressTrack = useThemeColor({}, "inputFill");
  const scrollRef = useRef<ScrollView>(null);
  const exerciseLayouts = useRef<Record<string, number>>({});

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
  }, [completedSets, totalSets]);

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
            text: t("finish.confirmFinish"),
            style: "destructive",
            onPress: () => {
              finishWorkout();
              router.replace("/workout-summary");
            },
          },
        ]
      );
    } else {
      finishWorkout();
      router.replace("/workout-summary");
    }
  }, [totalSets, completedSets, finishWorkout, router, t]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={[styles.root, { backgroundColor: background }]}>
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
              style={[styles.progressTrack, { backgroundColor: progressTrack }]}
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
                      style={[Typography.titleSm, styles.addExerciseButtonText]}
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
                      <ExerciseCard exercise={exercise} />
                    </View>
                  ))}
                  <TouchableOpacity
                    style={[styles.addExerciseButton, { borderColor: primary }]}
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
