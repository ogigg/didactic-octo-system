import { useThemeColor } from "@/hooks/use-theme-color";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

interface ProgressionPillProps {
  type:
    | "weight_up"
    | "reps_up"
    | "maintained"
    | "new_exercise"
    | null
    | undefined;
}

export function ProgressionPill({ type }: ProgressionPillProps) {
  const { t } = useTranslation("workout");

  const success = useThemeColor({}, "success");
  const warning = useThemeColor({}, "warning");

  if (!type || type === "new_exercise") return null;

  const isProgression = type === "weight_up" || type === "reps_up";
  const color = isProgression ? success : warning;

  const labelMap = {
    weight_up: t("progression.weightUp"),
    reps_up: t("progression.repsUp"),
    maintained: t("progression.maintained"),
  } as const;

  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: color + "1A", borderColor: color + "40" },
      ]}
      accessibilityRole="text"
      accessibilityLabel={labelMap[type]}
    >
      <Text style={[styles.label, { color }]}>{labelMap[type]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderWidth: 1,
    alignSelf: "center",
  },
  label: {
    ...Typography.micro,
    fontWeight: "600",
    textTransform: "uppercase",
  },
});
