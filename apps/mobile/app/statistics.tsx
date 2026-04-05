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

import { MuscleDistributionCard } from "@/components/history/muscle-distribution-card";
import { HeatmapChart } from "@/components/stats/heatmap-chart";
import { PeriodSelector } from "@/components/stats/period-selector";
import { PRList } from "@/components/stats/pr-list";
import { VolumeBarChart } from "@/components/stats/volume-bar-chart";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Elevation, Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import {
  useHeatmapData,
  useMuscleDistributionStats,
  usePersonalRecords,
  useVolumeOverTime,
} from "@/hooks/use-stats-queries";
import { useWorkoutStats } from "@/hooks/use-workout-stats";
import type { StatsPeriod } from "@/lib/api/stats";

function SectionCard({ children }: { children: React.ReactNode }) {
  const backgroundSubtle = useThemeColor({}, "backgroundSubtle");
  return (
    <View
      style={[styles.card, { backgroundColor: backgroundSubtle }, Elevation.sm]}
    >
      {children}
    </View>
  );
}

function SectionTitle({ children }: { children: string }) {
  const textColor = useThemeColor({}, "text");
  return (
    <Text
      style={[Typography.titleSm, { color: textColor }, styles.sectionTitle]}
    >
      {children}
    </Text>
  );
}

function LoadingPlaceholder() {
  const textMuted = useThemeColor({}, "textMuted");
  return (
    <View style={styles.loadingRow}>
      <ActivityIndicator size="small" color={textMuted} />
    </View>
  );
}

export default function StatisticsScreen() {
  const { t } = useTranslation("stats");

  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const primaryColor = useThemeColor({}, "primary");
  const backgroundSubtle = useThemeColor({}, "backgroundSubtle");
  const borderColor = useThemeColor({}, "border");

  const [musclePeriod, setMusclePeriod] = useState<StatsPeriod>("30d");
  const [volumePeriod, setVolumePeriod] = useState<StatsPeriod>("90d");

  const { data: heatmapData, isLoading: heatmapLoading } = useHeatmapData();
  const {
    totalWorkouts,
    streakWeeks,
    isLoading: statsLoading,
  } = useWorkoutStats();
  const { segments, isLoading: muscleLoading } =
    useMuscleDistributionStats(musclePeriod);
  const { data: volumeData, isLoading: volumeLoading } =
    useVolumeOverTime(volumePeriod);
  const { data: prData, isLoading: prLoading } = usePersonalRecords();

  const workoutsThisYear = heatmapData?.length ?? 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <ScreenHeader title={t("title")} />

        {/* Heatmap Section */}
        <SectionCard>
          <SectionTitle>{t("sections.activity")}</SectionTitle>
          {heatmapLoading ? (
            <LoadingPlaceholder />
          ) : (
            <>
              <HeatmapChart data={heatmapData ?? []} />
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
        </SectionCard>

        {/* Muscle Distribution Section */}
        <SectionCard>
          <SectionTitle>{t("sections.muscles")}</SectionTitle>
          <PeriodSelector
            selected={musclePeriod}
            onChange={(p) => setMusclePeriod(p as StatsPeriod)}
          />
          {muscleLoading ? (
            <LoadingPlaceholder />
          ) : segments && segments.length > 0 ? (
            <View style={styles.muscleCard}>
              <MuscleDistributionCard
                segments={segments}
                title=""
                titleColor={textColor}
                backgroundColor={backgroundSubtle}
                borderColor={borderColor}
                showBorder={false}
              />
            </View>
          ) : (
            <View style={styles.loadingRow}>
              <Text style={[Typography.body, { color: textMuted }]}>
                {t("empty.subtitle")}
              </Text>
            </View>
          )}
        </SectionCard>

        {/* Volume Over Time Section */}
        <SectionCard>
          <SectionTitle>{t("sections.volume")}</SectionTitle>
          <PeriodSelector
            selected={volumePeriod}
            onChange={(p) => setVolumePeriod(p as StatsPeriod)}
          />
          <View style={styles.chartSpacer} />
          {volumeLoading ? (
            <LoadingPlaceholder />
          ) : volumeData && volumeData.length > 0 ? (
            <VolumeBarChart data={volumeData} />
          ) : (
            <View style={styles.loadingRow}>
              <Text style={[Typography.body, { color: textMuted }]}>
                {t("empty.subtitle")}
              </Text>
            </View>
          )}
        </SectionCard>

        {/* Personal Records Section */}
        <SectionCard>
          <SectionTitle>{t("sections.records")}</SectionTitle>
          {prLoading ? (
            <LoadingPlaceholder />
          ) : (
            <PRList records={prData ?? []} emptyText={t("records.empty")} />
          )}
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing["3xl"],
    gap: Spacing.xl,
  },
  card: {
    borderRadius: Radii.lg,
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  sectionTitle: {
    marginBottom: Spacing.xs,
  },
  loadingRow: {
    alignItems: "center",
    paddingVertical: Spacing["2xl"],
  },
  heatmapSummary: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.sm,
  },
  muscleCard: {
    marginTop: Spacing.xs,
  },
  chartSpacer: {
    height: Spacing.xs,
  },
});
