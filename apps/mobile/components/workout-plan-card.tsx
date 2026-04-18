import { useThemeColor } from "@/hooks/use-theme-color";
import { Fonts, Radii, Spacing, Typography } from "@/constants/theme";
import { Button } from "@/components/ui/button";
import { GradientSurface } from "@/components/ui/gradient-surface";
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
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const success = useThemeColor({}, "success");
  const borderSubtle = useThemeColor({}, "borderSubtle");
  const primary = useThemeColor({}, "primary");

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isActive]);

  const elapsed = isActive && startedAtMs ? now - startedAtMs : 0;

  return (
    <GradientSurface
      variant="accent"
      radius="lg"
      bordered
      style={styles.container}
    >
      <View style={styles.headerRow}>
        <View style={styles.eyebrowRow}>
          <View
            style={[
              styles.eyebrowDot,
              { backgroundColor: isActive ? success : primary },
            ]}
          />
          <Text
            style={[Typography.label, { color: isActive ? success : primary }]}
          >
            {isActive ? "IN PROGRESS" : "NEXT UP"}
          </Text>
        </View>
        {isActive && (
          <Text style={[styles.timerText, { color: success }]}>
            {formatElapsed(elapsed)}
          </Text>
        )}
      </View>

      <Text style={[styles.title, { color: textColor }]} numberOfLines={2}>
        {title}
      </Text>

      <View style={styles.exerciseList}>
        {exercises.slice(0, 3).map((exercise, index) => (
          <View
            key={index}
            style={[
              styles.exerciseRow,
              index > 0 && {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: borderSubtle,
              },
            ]}
          >
            <Text
              style={[Typography.body, { color: textColor, flex: 1 }]}
              numberOfLines={1}
            >
              {exercise.name}
            </Text>
            <Text
              style={[
                Typography.caption,
                { color: textSecondary, fontVariant: ["tabular-nums"] },
              ]}
            >
              {exercise.sets}×{exercise.reps}
            </Text>
          </View>
        ))}
        {exercises.length > 3 ? (
          <Text
            style={[
              Typography.caption,
              { color: textMuted, marginTop: Spacing.sm },
            ]}
          >
            +{exercises.length - 3} more
          </Text>
        ) : null}
      </View>

      <Button
        variant={isActive ? "success" : "primary"}
        label={isActive ? "Resume Workout" : "Start Workout"}
        onPress={onStartWorkout}
        accessibilityLabel={isActive ? "Resume workout" : "Start workout"}
      />
    </GradientSurface>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.xl,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  eyebrowDot: {
    width: 6,
    height: 6,
    borderRadius: Radii.full,
  },
  timerText: {
    ...Typography.caption,
    fontFamily: Fonts?.mono,
    fontVariant: ["tabular-nums"],
    fontWeight: "600",
  },
  title: {
    ...Typography.titleLg,
    marginBottom: Spacing.lg,
  },
  exerciseList: {
    marginBottom: Spacing.xl,
  },
  exerciseRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.md,
  },
});
