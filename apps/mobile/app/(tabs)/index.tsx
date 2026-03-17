import { useOnboardingStore } from "@/stores/onboarding-store";
import { useThemeColor } from "@/hooks/use-theme-color";
import { Elevation, Radii, Spacing, Typography } from "@/constants/theme";
import { WorkoutPlanCard } from "@/components/workout-plan-card";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const MOCK_COMPLETED = 1;

interface MockExercise {
  name: string;
  muscleGroup: string;
  sets: number;
  reps: string;
}

const MOCK_EXERCISES: MockExercise[] = [
  { name: "Barbell Bench Press", muscleGroup: "Chest", sets: 4, reps: "8-10" },
  {
    name: "Incline Dumbbell Press",
    muscleGroup: "Chest",
    sets: 3,
    reps: "10-12",
  },
  { name: "Cable Flyes", muscleGroup: "Chest", sets: 3, reps: "12-15" },
  {
    name: "Overhead Tricep Extension",
    muscleGroup: "Triceps",
    sets: 3,
    reps: "10-12",
  },
  { name: "Lateral Raises", muscleGroup: "Shoulders", sets: 3, reps: "12-15" },
];

export default function HomeScreen() {
  const frequency = useOnboardingStore((s) => s.frequency) ?? 3;

  const primary = useThemeColor({}, "primary");
  const border = useThemeColor({}, "border");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const backgroundSubtle = useThemeColor({}, "backgroundSubtle");

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Greeting */}
          <Text style={[Typography.displayLg, { color: textColor }]}>
            Your Week
          </Text>
          <Text
            style={[Typography.body, { color: textSecondary }, styles.subtitle]}
          >
            Keep the momentum going — you're doing great.
          </Text>

          {/* Weekly Progress Card */}
          <View
            style={[
              styles.card,
              { backgroundColor: backgroundSubtle },
              Elevation.sm,
            ]}
          >
            <View style={styles.progressHeader}>
              <Text style={[Typography.titleSm, { color: textColor }]}>
                Weekly Progress
              </Text>
              <Text style={[Typography.titleMd, { color: primary }]}>
                {MOCK_COMPLETED}/{frequency}
              </Text>
            </View>
            <View
              style={styles.progressBar}
              accessibilityRole="progressbar"
              accessibilityValue={{
                min: 0,
                max: frequency,
                now: MOCK_COMPLETED,
              }}
            >
              {Array.from({ length: frequency }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.progressSegment,
                    {
                      backgroundColor: i < MOCK_COMPLETED ? primary : border,
                    },
                  ]}
                />
              ))}
            </View>
            <Text style={[Typography.caption, { color: textMuted }]}>
              {MOCK_COMPLETED} workout{MOCK_COMPLETED !== 1 ? "s" : ""}{" "}
              completed this week
            </Text>
          </View>

          {/* Next Workout */}
          <WorkoutPlanCard
            title="Push Day"
            exercises={MOCK_EXERCISES}
            onStartWorkout={() => {}}
          />

          {/* History Button */}
          <TouchableOpacity
            style={[styles.historyButton, { borderColor: border }]}
            accessibilityRole="button"
            accessibilityLabel="See workout history"
          >
            <Text style={[Typography.titleSm, { color: primary }]}>
              See Workout History
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  scroll: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing["2xl"],
    paddingBottom: Spacing["3xl"],
    gap: Spacing.xl,
  },
  subtitle: {
    marginTop: Spacing.xs,
  },
  card: {
    borderRadius: Radii.lg,
    padding: Spacing.xl,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  progressBar: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  progressSegment: {
    flex: 1,
    height: 6,
    borderRadius: Radii.full,
  },
  historyButton: {
    borderWidth: 1,
    borderRadius: Radii.lg,
    paddingVertical: Spacing.lg,
    alignItems: "center",
  },
});
