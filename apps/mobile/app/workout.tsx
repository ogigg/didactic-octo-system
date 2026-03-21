import { WorkoutTopBar } from "@/components/workout/workout-top-bar";
import { WorkoutTimer } from "@/components/workout/workout-timer";
import { ExerciseCard } from "@/components/workout/exercise-card";
import { RestTimerBar } from "@/components/workout/rest-timer-bar";
import { useWorkoutStore } from "@/stores/workout-store";
import { useThemeColor } from "@/hooks/use-theme-color";
import { Spacing } from "@/constants/theme";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Alert,
  Keyboard,
  ScrollView,
  SafeAreaView,
  StyleSheet,
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
  const background = useThemeColor({}, "background");
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
  const progressWidth =
    `${Math.min(Math.max(progressRatio, 0), 1) * 100}%` as const;

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
              <View
                style={[
                  styles.progressFill,
                  { backgroundColor: primary, width: progressWidth },
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
              {exercises.map((exercise) => (
                <View
                  key={exercise.id}
                  onLayout={(e) =>
                    handleExerciseLayout(exercise.id, e.nativeEvent.layout.y)
                  }
                >
                  <ExerciseCard exercise={exercise} />
                </View>
              ))}
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
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
  },
  progressTrack: {
    height: 5,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
});
