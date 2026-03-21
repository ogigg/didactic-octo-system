import { useThemeColor } from "@/hooks/use-theme-color";
import { Fonts, Spacing, Typography } from "@/constants/theme";
import { useWorkoutStore } from "@/stores/workout-store";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => String(n).padStart(2, "0");

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

export function WorkoutTimer() {
  const startedAtMs = useWorkoutStore((s) => s.startedAtMs);
  const primary = useThemeColor({}, "primary");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const elapsed = startedAtMs ? now - startedAtMs : 0;

  return (
    <View style={styles.container}>
      <Text
        style={[styles.timer, { color: primary }]}
        accessibilityRole="timer"
        accessibilityLabel={`Elapsed time: ${formatElapsed(elapsed)}`}
      >
        {formatElapsed(elapsed)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  timer: {
    ...Typography.displaySm,
    fontFamily: Fonts?.mono,
    fontVariant: ["tabular-nums"],
  },
});
