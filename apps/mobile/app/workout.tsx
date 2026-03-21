import { WorkoutTopBar } from "@/components/workout/workout-top-bar";
import { WorkoutTimer } from "@/components/workout/workout-timer";
import { ExerciseCard } from "@/components/workout/exercise-card";
import { RestTimerBar } from "@/components/workout/rest-timer-bar";
import { useWorkoutStore } from "@/stores/workout-store";
import { useThemeColor } from "@/hooks/use-theme-color";
import { Spacing } from "@/constants/theme";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import {
  Keyboard,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from "react-native";

export default function WorkoutScreen() {
  const router = useRouter();
  const exercises = useWorkoutStore((s) => s.exercises);
  const workoutName = useWorkoutStore((s) => s.workoutName);
  const finishWorkout = useWorkoutStore((s) => s.finishWorkout);
  const background = useThemeColor({}, "background");

  const handleDismiss = useCallback(() => {
    router.back();
  }, [router]);

  const handleFinish = useCallback(() => {
    finishWorkout();
    router.replace("/workout-summary");
  }, [finishWorkout, router]);

  return (
    <View style={[styles.root, { backgroundColor: background }]}>
      <SafeAreaView style={styles.safe}>
        <WorkoutTopBar
          workoutName={workoutName}
          onDismiss={handleDismiss}
          onFinish={handleFinish}
        />
        <WorkoutTimer />
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {exercises.map((exercise) => (
              <ExerciseCard key={exercise.id} exercise={exercise} />
            ))}
          </ScrollView>
        </TouchableWithoutFeedback>
        <RestTimerBar />
      </SafeAreaView>
    </View>
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
});
