import { useWorkoutStore } from "@/stores/workout-store";
import { useThemeColor } from "@/hooks/use-theme-color";
import { Button } from "@/components/ui/button";
import { Spacing, Typography } from "@/constants/theme";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

export default function WorkoutSummaryScreen() {
  const { t } = useTranslation("workout");
  const router = useRouter();
  const summary = useWorkoutStore((s) => s.completedWorkoutSummary);
  const clearWorkout = useWorkoutStore((s) => s.clearWorkout);
  const background = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");

  const handleReturnHome = useCallback(() => {
    clearWorkout();
    router.replace("/(tabs)");
  }, [clearWorkout, router]);

  return (
    <View style={[styles.root, { backgroundColor: background }]}>
      <SafeAreaView style={styles.safe}>
        <Text style={[Typography.titleLg, { color: textColor }, styles.title]}>
          {t("summary.title")}
        </Text>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[Typography.caption, { color: textSecondary }]}>
            {summary
              ? JSON.stringify(summary, null, 2)
              : "No workout data available."}
          </Text>
        </ScrollView>
        <View style={styles.footer}>
          <Button label={t("summary.returnHome")} onPress={handleReturnHome} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  title: {
    textAlign: "center",
    paddingVertical: Spacing.xl,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing["3xl"],
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing["3xl"],
  },
});
