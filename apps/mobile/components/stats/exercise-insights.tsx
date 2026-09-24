import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useWeightUnit } from "@/hooks/use-weight-unit";
import type { ExerciseSessionHistory } from "@/lib/api/exercise-detail";
import { getExerciseInsights } from "@/lib/exercise-insights";
import { formatExerciseDuration } from "@/lib/format-exercise-duration";

interface ExerciseInsightsProps {
  sessions: ExerciseSessionHistory[];
  isTime: boolean;
}

export function ExerciseInsights({ sessions, isTime }: ExerciseInsightsProps) {
  const { t, i18n } = useTranslation("exerciseDetail");
  const text = useThemeColor({}, "text");
  const secondary = useThemeColor({}, "textSecondary");
  const border = useThemeColor({}, "border");
  const weight = useWeightUnit();
  const insights = getExerciseInsights(sessions, isTime);
  const format = isTime
    ? (value: number) => formatExerciseDuration(Math.round(value))
    : weight.formatVolume;
  const date = (value: string) =>
    new Intl.DateTimeFormat(i18n.resolvedLanguage ?? i18n.language, {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(value));
  const { comparison, progress } = insights;
  const change =
    comparison && comparison.previous > 0
      ? Math.round((comparison.recent / comparison.previous - 1) * 100)
      : null;
  return (
    <View style={styles.container}>
      <Text style={[Typography.titleSm, { color: text }]}>
        {t("insights.title")}
      </Text>
      <Text style={[Typography.caption, { color: secondary }]}>
        {t("insights.scope", { count: insights.sessionCount })}
      </Text>
      <View style={[styles.section, { borderColor: border }]}>
        <Text style={[Typography.bodyMedium, { color: text }]}>
          {t(isTime ? "insights.durationProgress" : "insights.repProgress")}
        </Text>
        {progress ? (
          <>
            <Text style={[Typography.titleMd, { color: text }]}>
              {isTime
                ? `${formatExerciseDuration(progress.previous)} → ${formatExerciseDuration(progress.recent)}`
                : t("insights.repChange", {
                    previous: progress.previous,
                    recent: progress.recent,
                    weight: weight.formatSpaced(progress.load!),
                  })}
            </Text>
            <Text
              style={[Typography.caption, { color: secondary }]}
            >{`${date(progress.previousDate)} → ${date(progress.recentDate)}`}</Text>
            <Text style={[Typography.caption, { color: secondary }]}>
              {t(isTime ? "insights.durationHint" : "insights.repHint")}
            </Text>
          </>
        ) : (
          <Text style={[Typography.caption, { color: secondary }]}>
            {t(isTime ? "insights.needDuration" : "insights.needMatchingLoad")}
          </Text>
        )}
      </View>
      <View style={[styles.section, { borderColor: border }]}>
        <Text style={[Typography.bodyMedium, { color: text }]}>
          {t(
            isTime ? "insights.durationComparison" : "insights.volumeComparison"
          )}
        </Text>
        {comparison ? (
          <>
            <View style={styles.row}>
              <View style={styles.metric}>
                <Text style={[Typography.caption, { color: secondary }]}>
                  {t("insights.previousFive")}
                </Text>
                <Text style={[Typography.titleMd, { color: text }]}>
                  {format(comparison.previous)}
                </Text>
              </View>
              <View style={styles.metric}>
                <Text style={[Typography.caption, { color: secondary }]}>
                  {t("insights.latestFive")}
                </Text>
                <Text style={[Typography.titleMd, { color: text }]}>
                  {format(comparison.recent)}
                </Text>
              </View>
            </View>
            {change != null ? (
              <Text style={[Typography.bodyMedium, { color: text }]}>
                {t("insights.change", {
                  value: `${change > 0 ? "+" : ""}${change}%`,
                })}
              </Text>
            ) : null}
            <Text style={[Typography.caption, { color: secondary }]}>
              {t("insights.comparisonHint")}
            </Text>
          </>
        ) : (
          <Text style={[Typography.caption, { color: secondary }]}>
            {t("insights.needTen", {
              count: Math.max(0, 10 - insights.sessionCount),
            })}
          </Text>
        )}
      </View>
      <View style={[styles.section, { borderColor: border }]}>
        <Text style={[Typography.bodyMedium, { color: text }]}>
          {t("insights.frequency")}
        </Text>
        <View style={styles.row}>
          {insights.activity.map((item) => (
            <View key={item.period} style={styles.metric}>
              <Text style={[Typography.caption, { color: secondary }]}>
                {t("insights.lastDays", { count: item.period })}
              </Text>
              <Text style={[Typography.titleMd, { color: text }]}>
                {t("insights.trainingDays", {
                  value: `${item.incomplete ? "≥" : ""}${item.count}`,
                })}
              </Text>
            </View>
          ))}
        </View>
        <Text style={[Typography.caption, { color: secondary }]}>
          {insights.daysSinceLast == null
            ? t("insights.notYet")
            : insights.daysSinceLast === 0
              ? t("insights.lastToday")
              : t("insights.lastTrained", { count: insights.daysSinceLast })}
        </Text>
        {insights.activity.some((item) => item.incomplete) ? (
          <Text style={[Typography.caption, { color: secondary }]}>
            {t("insights.limitedHistory")}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.sm },
  section: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.lg,
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  row: { flexDirection: "row", gap: Spacing.lg },
  metric: { flex: 1, gap: Spacing.xs },
});
