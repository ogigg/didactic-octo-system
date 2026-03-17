import { useThemeColor } from "@/hooks/use-theme-color";
import { Elevation, Radii, Spacing, Typography } from "@/constants/theme";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface Exercise {
  name: string;
  muscleGroup: string;
  sets: number;
  reps: string;
}

interface WorkoutPlanCardProps {
  title: string;
  exercises: Exercise[];
  onStartWorkout: () => void;
}

export function WorkoutPlanCard({
  title,
  exercises,
  onStartWorkout,
}: WorkoutPlanCardProps) {
  const backgroundSubtle = useThemeColor({}, "backgroundSubtle");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const primary = useThemeColor({}, "primary");
  const borderSubtle = useThemeColor({}, "borderSubtle");

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: backgroundSubtle },
        Elevation.sm,
      ]}
    >
      <Text style={[Typography.label, { color: textMuted }, styles.label]}>
        NEXT WORKOUT
      </Text>
      <Text style={[Typography.titleMd, { color: textColor }, styles.title]}>
        {title}
      </Text>

      <View style={styles.exerciseList}>
        {exercises.map((exercise, index) => (
          <View
            key={index}
            style={[
              styles.exerciseRow,
              index > 0 && { borderTopWidth: 1, borderTopColor: borderSubtle },
            ]}
          >
            <View style={styles.exerciseInfo}>
              <Text style={[Typography.bodyMedium, { color: textColor }]}>
                {exercise.name}
              </Text>
              <Text style={[Typography.caption, { color: textMuted }]}>
                {exercise.muscleGroup}
              </Text>
            </View>
            <Text style={[Typography.body, { color: textSecondary }]}>
              {exercise.sets}×{exercise.reps}
            </Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        onPress={onStartWorkout}
        style={[styles.startButton, { backgroundColor: primary }]}
        accessibilityRole="button"
        accessibilityLabel="Start workout"
      >
        <Text style={[Typography.titleSm, styles.startButtonText]}>
          Start Workout
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Radii.lg,
    padding: Spacing.xl,
  },
  label: {
    marginBottom: Spacing.xs,
  },
  title: {
    marginBottom: Spacing.lg,
  },
  exerciseList: {
    marginBottom: Spacing.xl,
  },
  exerciseRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
  },
  exerciseInfo: {
    flex: 1,
    gap: 2,
  },
  startButton: {
    borderRadius: Radii.lg,
    paddingVertical: Spacing.lg,
    alignItems: "center",
  },
  startButtonText: {
    color: "#FFFFFF",
  },
});
