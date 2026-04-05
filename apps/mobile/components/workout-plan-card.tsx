import { useThemeColor } from "@/hooks/use-theme-color";
import {
  Elevation,
  Fonts,
  Radii,
  Spacing,
  Typography,
} from "@/constants/theme";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

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
  isActive?: boolean;
  startedAtMs?: number | null;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function WorkoutPlanCard({
  title,
  exercises,
  onStartWorkout,
  isActive = false,
  startedAtMs,
}: WorkoutPlanCardProps) {
  const backgroundSubtle = useThemeColor({}, "backgroundSubtle");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const success = useThemeColor({}, "success");
  const borderSubtle = useThemeColor({}, "borderSubtle");

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isActive]);

  const elapsed = isActive && startedAtMs ? now - startedAtMs : 0;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: backgroundSubtle },
        Elevation.sm,
      ]}
    >
      {/* Header row: label + live timer */}
      <View style={styles.headerRow}>
        <Text
          style={[Typography.label, { color: isActive ? success : textMuted }]}
        >
          {isActive ? "IN PROGRESS" : "NEXT WORKOUT"}
        </Text>
        {isActive && (
          <View style={styles.liveIndicator}>
            <View style={[styles.liveDot, { backgroundColor: success }]} />
            <Text style={[styles.timerText, { color: success }]}>
              {formatElapsed(elapsed)}
            </Text>
          </View>
        )}
      </View>

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

      <Button
        variant={isActive ? "success" : "primary"}
        label={isActive ? "Resume Workout" : "Start Workout"}
        onPress={onStartWorkout}
        accessibilityLabel={isActive ? "Resume workout" : "Start workout"}
        style={styles.startButton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Radii.lg,
    padding: Spacing.xl,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: Radii.full,
  },
  timerText: {
    ...Typography.caption,
    fontFamily: Fonts?.mono,
    fontVariant: ["tabular-nums"],
    fontWeight: "600",
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
    paddingVertical: Spacing.lg,
  },
});
