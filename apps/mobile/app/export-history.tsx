import { File, Paths } from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AmbientGlow } from "@/components/ambient-glow";
import { PeriodSelector } from "@/components/stats/period-selector";
import { Button } from "@/components/ui/button";
import { GradientSurface } from "@/components/ui/gradient-surface";
import { ScreenHeader } from "@/components/ui/screen-header";
import { SectionHeader } from "@/components/ui/section-header";
import { Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useWeightUnit } from "@/hooks/use-weight-unit";
import { fetchStatsPersonalRecords } from "@/lib/api/stats";
import { fetchCompletedWorkoutDetails } from "@/lib/api/workouts";
import {
  buildWorkoutCoachReportFile,
  type CoachReportCopy,
} from "@/lib/workout-coach-report";
import {
  buildWorkoutExportFile,
  getWorkoutExportStartIso,
  type WorkoutExportFormat,
  type WorkoutExportPeriod,
} from "@/lib/workout-history-export";

export default function ExportHistoryScreen() {
  const { t, i18n } = useTranslation("accountSettings");
  const { unit } = useWeightUnit();
  const [period, setPeriod] = useState<WorkoutExportPeriod>("30d");
  const [format, setFormat] = useState<WorkoutExportFormat>("csv");
  const [isExporting, setIsExporting] = useState(false);
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const background = useThemeColor({}, "background");

  const periods = [
    { key: "7d", label: t("export.periods.seven") },
    { key: "30d", label: t("export.periods.thirty") },
    { key: "90d", label: t("export.periods.ninety") },
    { key: "all", label: t("export.periods.all") },
  ];
  const formats = [
    { key: "csv", label: t("export.formats.csv") },
    { key: "json", label: t("export.formats.json") },
    { key: "pdf", label: t("export.formats.pdf") },
  ];

  async function handleExport() {
    if (isExporting) return;
    setIsExporting(true);

    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert(t("export.unavailableTitle"), t("export.unavailableBody"));
        return;
      }

      const now = new Date();
      const [workouts, personalRecords] = await Promise.all([
        fetchCompletedWorkoutDetails(
          getWorkoutExportStartIso(period, now),
          now.toISOString()
        ),
        format === "pdf" ? fetchStatsPersonalRecords() : Promise.resolve([]),
      ]);

      if (workouts.length === 0) {
        Alert.alert(t("export.emptyTitle"), t("export.emptyBody"));
        return;
      }

      const exportFile =
        format === "pdf"
          ? buildWorkoutCoachReportFile({
              copy: getCoachReportCopy(t),
              exportedAt: now,
              locale: i18n.resolvedLanguage ?? i18n.language,
              period,
              personalRecords,
              unit,
              workouts,
            })
          : buildWorkoutExportFile(workouts, period, format, now);
      const file = new File(Paths.cache, exportFile.name);
      file.create({ overwrite: true });

      if (format === "pdf") {
        const rendered = await Print.printToFileAsync({
          html: exportFile.contents,
        });
        file.write(await new File(rendered.uri).bytes());
      } else {
        file.write(exportFile.contents);
      }

      await Sharing.shareAsync(file.uri, {
        UTI: exportFile.uti,
        dialogTitle: t("export.dialogTitle"),
        mimeType: exportFile.mimeType,
      });
    } catch {
      Alert.alert(t("export.errorTitle"), t("export.errorBody"));
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: background }]}>
      <AmbientGlow variant="subtle" />
      <SafeAreaView style={styles.safe}>
        <ScreenHeader
          title={t("export.title")}
          backAccessibilityLabel={t("accessibility.back")}
        />
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[Typography.body, { color: textSecondary }]}>
            {t("export.intro")}
          </Text>

          <View style={styles.section}>
            <SectionHeader title={t("export.periodLabel")} />
            <PeriodSelector
              selected={period}
              onChange={(value) => setPeriod(value as WorkoutExportPeriod)}
              periods={periods}
              compact
            />
          </View>

          <View style={styles.section}>
            <SectionHeader title={t("export.formatLabel")} />
            <PeriodSelector
              selected={format}
              onChange={(value) => setFormat(value as WorkoutExportFormat)}
              periods={formats}
            />
            <Text style={[Typography.caption, { color: textSecondary }]}>
              {t(`export.formatHelp.${format}`)}
            </Text>
          </View>

          <GradientSurface variant="surface" bordered style={styles.note}>
            <Text style={[Typography.titleSm, { color: textColor }]}>
              {t("export.privacyTitle")}
            </Text>
            <Text style={[Typography.body, { color: textSecondary }]}>
              {t("export.privacyBody")}
            </Text>
          </GradientSurface>

          <Button
            label={t("export.button", { format: format.toUpperCase() })}
            accessibilityLabel={t("export.button", {
              format: format.toUpperCase(),
            })}
            icon="square.and.arrow.up"
            loading={isExporting}
            onPress={() => void handleExport()}
          />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function getCoachReportCopy(
  t: ReturnType<typeof useTranslation<"accountSettings">>["t"]
): CoachReportCopy {
  return {
    title: t("export.report.title"),
    subtitle: t("export.report.subtitle"),
    generated: t("export.report.generated"),
    period: t("export.report.period"),
    allTime: t("export.periods.all"),
    workouts: t("export.report.workouts"),
    completedSets: t("export.report.completedSets"),
    totalVolume: t("export.report.totalVolume"),
    trainingTime: t("export.report.trainingTime"),
    averageRpe: t("export.report.averageRpe"),
    completionRate: t("export.report.completionRate"),
    progressTitle: t("export.report.progressTitle"),
    progressInsufficient: t("export.report.progressInsufficient"),
    volumeIncreased: t("export.report.volumeIncreased"),
    volumeDecreased: t("export.report.volumeDecreased"),
    volumeSteady: t("export.report.volumeSteady"),
    weeklyTitle: t("export.report.weeklyTitle"),
    weeklyEmpty: t("export.report.weeklyEmpty"),
    volumeTitle: t("export.report.volumeTitle"),
    completionTitle: t("export.report.completionTitle"),
    completedLabel: t("export.report.completedLabel"),
    incompleteLabel: t("export.report.incompleteLabel"),
    personalRecordsTitle: t("export.report.personalRecordsTitle"),
    personalRecordsSubtitle: t("export.report.personalRecordsSubtitle"),
    personalRecordsEmpty: t("export.report.personalRecordsEmpty"),
    exercise: t("export.report.exercise"),
    bestWeight: t("export.report.bestWeight"),
    bestSetVolume: t("export.report.bestSetVolume"),
    estimatedOneRepMax: t("export.report.estimatedOneRepMax"),
    recentWorkoutsTitle: t("export.report.recentWorkoutsTitle"),
    date: t("export.report.date"),
    workout: t("export.report.workout"),
    sets: t("export.report.sets"),
    volume: t("export.report.volume"),
    duration: t("export.report.duration"),
    minutes: t("export.report.minutes"),
    sessions: t("export.report.sessions"),
    footer: t("export.report.footer"),
  };
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
  section: { gap: Spacing.md },
  note: { padding: Spacing.lg, gap: Spacing.sm },
});
