import { useOnboardingStore } from "@/stores/onboarding-store";
import { useWorkoutStore } from "@/stores/workout-store";
import type { WorkoutExercise } from "@/stores/workout-store";
import { useWorkoutTemplatesStore } from "@/stores/workout-templates-store";
import type { WorkoutTemplate } from "@/stores/workout-templates-store";
import { useThemeColor } from "@/hooks/use-theme-color";
import { Elevation, Radii, Spacing, Typography } from "@/constants/theme";
import { AmbientGlow } from "@/components/ambient-glow";
import {
  WorkoutTemplateCard,
  CreateWorkoutCard,
} from "@/components/workout-template-card";
import { WorkoutPlanCard } from "@/components/workout-plan-card";
import { useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
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

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useTranslation("home");
  const frequency = useOnboardingStore((s) => s.frequency) ?? 3;
  const startWorkout = useWorkoutStore((s) => s.startWorkout);
  const isWorkoutActive = useWorkoutStore((s) => s.isActive);
  const workoutName = useWorkoutStore((s) => s.workoutName);
  const workoutExercises = useWorkoutStore((s) => s.exercises);
  const startedAtMs = useWorkoutStore((s) => s.startedAtMs);
  const templates = useWorkoutTemplatesStore((s) => s.templates);

  const handleGenerateWorkout = useCallback(() => {
    router.push("/generate-workout" as "/generate-workout");
  }, [router]);

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

  const handleResumeWorkout = useCallback(() => {
    router.push("/workout");
  }, [router]);

  const activeExercises = useMemo(
    () =>
      workoutExercises.map((ex) => ({
        name: ex.name,
        muscleGroup: "",
        sets: ex.sets.length,
        reps: ex.sets[0] ? `${ex.sets[0].reps || "—"}` : "—",
      })),
    [workoutExercises]
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

          {/* Current Workout */}
          {isWorkoutActive && (
            <WorkoutPlanCard
              title={workoutName}
              exercises={activeExercises}
              onStartWorkout={handleResumeWorkout}
              isActive
              startedAtMs={startedAtMs}
            />
          )}

          {/* Generate AI Workout */}
          <TouchableOpacity
            onPress={handleGenerateWorkout}
            style={[
              styles.generateCard,
              { backgroundColor: backgroundSubtle },
              Elevation.sm,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Generate AI Workout"
          >
            <Text style={[Typography.label, { color: primary }]}>
              AI-POWERED
            </Text>
            <Text
              style={[
                Typography.titleMd,
                { color: textColor },
                styles.generateTitle,
              ]}
            >
              Generate Workout
            </Text>
            <Text style={[Typography.body, { color: textSecondary }]}>
              Get a personalized workout based on your goals and history
            </Text>
          </TouchableOpacity>

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
  generateCard: {
    borderRadius: Radii.lg,
    padding: Spacing.xl,
  },
  generateTitle: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
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
