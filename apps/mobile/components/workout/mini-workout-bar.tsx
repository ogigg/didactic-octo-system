import { useThemeColor } from "@/hooks/use-theme-color";
import {
  Elevation,
  Fonts,
  Radii,
  Spacing,
  Typography,
} from "@/constants/theme";
import { useWorkoutStore } from "@/stores/workout-store";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function MiniWorkoutBar() {
  const { t } = useTranslation("workout");
  const router = useRouter();
  const isActive = useWorkoutStore((s) => s.isActive);
  const workoutName = useWorkoutStore((s) => s.workoutName);
  const startedAtMs = useWorkoutStore((s) => s.startedAtMs);

  const backgroundElevated = useThemeColor({}, "backgroundElevated");
  const primary = useThemeColor({}, "primary");
  const textColor = useThemeColor({}, "text");
  const border = useThemeColor({}, "border");

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isActive]);

  if (!isActive) return null;

  const elapsed = startedAtMs ? now - startedAtMs : 0;

  return (
    <Pressable
      onPress={() => router.push("/workout")}
      accessibilityRole="button"
      accessibilityLabel={t("miniBar.resume")}
      style={[
        styles.container,
        { backgroundColor: backgroundElevated, borderColor: border },
        Elevation.sm,
      ]}
    >
      <View style={styles.dot} />
      <Text
        style={[Typography.bodyMedium, { color: textColor }]}
        numberOfLines={1}
      >
        {workoutName}
      </Text>
      <Text style={[styles.timer, { color: primary }]}>
        {formatElapsed(elapsed)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radii.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#34C759",
  },
  timer: {
    ...Typography.bodyMedium,
    fontFamily: Fonts?.mono,
    fontVariant: ["tabular-nums"],
    marginLeft: "auto",
  },
});
