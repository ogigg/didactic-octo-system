import { useOnboardingStore } from "@/stores/onboarding-store";
import { useWorkoutStore } from "@/stores/workout-store";
import type { WorkoutExercise } from "@/stores/workout-store";
import { useWorkoutTemplatesStore } from "@/stores/workout-templates-store";
import type { WorkoutTemplate } from "@/stores/workout-templates-store";
import { useThemeColor } from "@/hooks/use-theme-color";
import { Elevation, Radii, Spacing, Typography } from "@/constants/theme";
import { AmbientGlow } from "@/components/ambient-glow";
import { WorkoutPlanCard } from "@/components/workout-plan-card";
import {
  WorkoutTemplateCard,
  CreateWorkoutCard,
} from "@/components/workout-template-card";
import { MOCK_EXERCISES, MOCK_WORKOUT_NAME } from "@/data/mock-workout";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
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

const HOME_EXERCISES: MockExercise[] = [
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
  const router = useRouter();
  const { t } = useTranslation("home");
  const frequency = useOnboardingStore((s) => s.frequency) ?? 3;
  const startWorkout = useWorkoutStore((s) => s.startWorkout);
  const isWorkoutActive = useWorkoutStore((s) => s.isActive);
  const startedAtMs = useWorkoutStore((s) => s.startedAtMs);
  const templates = useWorkoutTemplatesStore((s) => s.templates);

  const handleStartWorkout = useCallback(() => {
    if (!isWorkoutActive) {
      startWorkout(MOCK_WORKOUT_NAME, MOCK_EXERCISES);
    }
    router.push("/workout");
  }, [isWorkoutActive, startWorkout, router]);

  const handleCreateWorkout = useCallback(() => {
    if (!isWorkoutActive) {
      startWorkout(t("myWorkouts.newWorkoutName"), []);
    }
    router.push("/workout");
  }, [isWorkoutActive, startWorkout, t, router]);

  const handleStartTemplate = useCallback(
    (template: WorkoutTemplate) => {
      if (!isWorkoutActive) {
        const exercises: WorkoutExercise[] = template.exercises.map((ex) => ({
          id: ex.id,
          name: ex.name,
          restDurationSeconds: 90,
          notes: "",
          sets: Array.from({ length: 3 }, (_, i) => ({
            id: `set-${ex.id}-${i}-${Date.now()}`,
            type: "working" as const,
            kg: "",
            reps: "",
            rpe: null,
            isCompleted: false,
            previousDisplay: null,
          })),
        }));
        startWorkout(template.name, exercises);
      }
      router.push("/workout");
    },
    [isWorkoutActive, startWorkout, router]
  );

  const primary = useThemeColor({}, "primary");
  const border = useThemeColor({}, "border");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const backgroundSubtle = useThemeColor({}, "backgroundSubtle");

  return (
    <View style={styles.root}>
      <AmbientGlow variant="hero" />
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

          {/* My Workouts */}
          <View>
            <Text
              style={[
                Typography.titleMd,
                { color: textColor },
                styles.sectionTitle,
              ]}
            >
              {t("myWorkouts.title")}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.templateList}
            >
              {templates.map((template) => (
                <WorkoutTemplateCard
                  key={template.id}
                  template={template}
                  onPress={() => handleStartTemplate(template)}
                />
              ))}
              <CreateWorkoutCard
                label={t("myWorkouts.create")}
                onPress={handleCreateWorkout}
              />
            </ScrollView>
          </View>

          {/* Next Workout */}
          <WorkoutPlanCard
            title="Push Day"
            exercises={HOME_EXERCISES}
            onStartWorkout={handleStartWorkout}
            isActive={isWorkoutActive}
            startedAtMs={startedAtMs}
          />

          {/* History Button */}
          <TouchableOpacity
            style={[styles.historyButton, { borderColor: border }]}
            accessibilityRole="button"
            accessibilityLabel="See workout history"
            onPress={() => router.push("/history")}
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
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  templateList: {
    gap: Spacing.md,
    paddingRight: Spacing.xl,
  },
});
