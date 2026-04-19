import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AmbientGlow } from "@/components/ambient-glow";
import { DonutChart } from "@/components/history/donut-chart";
import { MuscleLegend } from "@/components/history/muscle-legend";
import { HeatmapChart } from "@/components/stats/heatmap-chart";
import { PeriodSelector } from "@/components/stats/period-selector";
import { PRList } from "@/components/stats/pr-list";
import { VolumeBarChart } from "@/components/stats/volume-bar-chart";
import { ScreenHeader } from "@/components/ui/screen-header";
import { SectionHeader } from "@/components/ui/section-header";
import { Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import {
  useHeatmapData,
  useMuscleDistributionStats,
  usePersonalRecords,
  useVolumeOverTime,
} from "@/hooks/use-stats-queries";
import { useWorkoutStats } from "@/hooks/use-workout-stats";
import type { StatsPeriod } from "@/lib/api/stats";

function LoadingPlaceholder() {
  const textMuted = useThemeColor({}, "textMuted");
  return (
    <View style={styles.loadingRow}>
      <ActivityIndicator size="small" color={textMuted} />
    </View>
  );
}

function EmptyLine({ text }: { text: string }) {
  const textMuted = useThemeColor({}, "textMuted");
  return (
    <View style={styles.emptyRow}>
      <Text style={[Typography.caption, { color: textMuted }]}>{text}</Text>
    </View>
  );
}

const PERIOD_TO_WEEKS: Record<StatsPeriod, number> = {
  "30d": 5,
  "90d": 13,
  "1y": 52,
  all: 52,
};

export default function StatisticsScreen() {
  const { t } = useTranslation("stats");

  const textSecondary = useThemeColor({}, "textSecondary");
  const primaryColor = useThemeColor({}, "primary");

  const [period, setPeriod] = useState<StatsPeriod>("90d");

  const { data: heatmapData, isLoading: heatmapLoading } = useHeatmapData();
  const {
    totalWorkouts,
    streakWeeks,
    isLoading: statsLoading,
  } = useWorkoutStats();
  const { segments, isLoading: muscleLoading } =
    useMuscleDistributionStats(period);
  const { data: volumeData, isLoading: volumeLoading } =
    useVolumeOverTime(period);
  const { data: prData, isLoading: prLoading } = usePersonalRecords();

  const muscleTotal = segments?.reduce((sum, seg) => sum + seg.value, 0) ?? 0;

  return (
    <View style={styles.root}>
      <AmbientGlow variant="subtle" />
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <ScreenHeader title={t("title")} />

          {/* Global period selector */}
          <PeriodSelector
            selected={period}
            onChange={(p) => setPeriod(p as StatsPeriod)}
          />

          {/* Activity heatmap */}
          <View style={styles.section}>
            <SectionHeader title={t("sections.activity")} />
            {heatmapLoading ? (
              <LoadingPlaceholder />
            ) : (
              <>
                <HeatmapChart
                  data={heatmapData ?? []}
                  weeks={PERIOD_TO_WEEKS[period]}
                />
                <View style={styles.heatmapSummary}>
                  <Text style={[Typography.caption, { color: textSecondary }]}>
                    {!statsLoading
                      ? t("heatmap.workoutsThisYear", {
                          count: totalWorkouts ?? 0,
                        })
                      : "—"}
                  </Text>
                  <Text style={[Typography.caption, { color: primaryColor }]}>
                    {!statsLoading
                      ? t("heatmap.streak", { count: streakWeeks ?? 0 })
                      : "—"}
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Muscle distribution */}
          <View style={styles.section}>
            <SectionHeader title={t("sections.muscles")} />
            {muscleLoading ? (
              <LoadingPlaceholder />
            ) : segments && segments.length > 0 ? (
              <View style={styles.muscleContent}>
                <View style={styles.donutWrap}>
                  <DonutChart segments={segments} size={160} strokeWidth={22} />
                </View>
                <MuscleLegend segments={segments} total={muscleTotal} />
              </View>
            ) : (
              <EmptyLine text={t("empty.subtitle")} />
            )}
          </View>

          {/* Volume over time */}
          <View style={styles.section}>
            <SectionHeader title={t("sections.volume")} />
            {volumeLoading ? (
              <LoadingPlaceholder />
            ) : volumeData && volumeData.length > 0 ? (
              <VolumeBarChart data={volumeData} />
            ) : (
              <EmptyLine text={t("empty.subtitle")} />
            )}
          </View>

          {/* Personal records */}
          <View style={styles.section}>
            <SectionHeader title={t("sections.records")} />
            {prLoading ? (
              <LoadingPlaceholder />
            ) : (
              <PRList records={prData ?? []} emptyText={t("records.empty")} />
            )}
          </View>
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
    paddingTop: Spacing.lg,
    paddingBottom: Spacing["3xl"],
    gap: Spacing["2xl"],
  },
  section: {
    gap: Spacing.md,
  },
  loadingRow: {
    alignItems: "center",
    paddingVertical: Spacing["2xl"],
  },
  emptyRow: {
    paddingVertical: Spacing.lg,
  },
  heatmapSummary: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  muscleContent: {
    gap: Spacing.lg,
  },
  donutWrap: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
});
