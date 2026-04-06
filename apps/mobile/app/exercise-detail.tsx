import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { PeriodSelector } from "@/components/stats/period-selector";
import { VolumeBarChart } from "@/components/stats/volume-bar-chart";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { useExerciseDetail } from "@/hooks/use-exercise-detail-query";
import { useExercise } from "@/hooks/use-exercises-query";
import { useThemeColor } from "@/hooks/use-theme-color";
import type {
  ExerciseDetailStats,
  ExerciseSessionHistory,
} from "@/lib/api/exercise-detail";

type Tab = "overview" | "history" | "howTo";

const TAB_ORDER: Tab[] = ["overview", "history", "howTo"];

function formatValue(value: number | null | undefined, suffix = ""): string {
  if (value == null || value <= 0) {
    return "-";
  }

  const rounded = Math.round(value * 10) / 10;
  const display = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(1);

  return `${display}${suffix}`;
}

function formatLongDate(date: string | null | undefined): string | null {
  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

function formatShortDate(date: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

function getAchievedLabel(
  t: ReturnType<typeof useTranslation>["t"],
  date: string | null | undefined
): string {
  const formattedDate = formatLongDate(date);

  return formattedDate
    ? t("overview.achievedOn", { date: formattedDate })
    : t("overview.noDate");
}

function hasAnyRecord(records: ExerciseDetailStats | undefined): boolean {
  return (
    !!records &&
    (records.max_weight_kg > 0 ||
      records.max_reps > 0 ||
      records.max_volume_set_kg > 0)
  );
}

function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");

  return (
    <View style={styles.sectionTitleWrap}>
      <Text style={[Typography.titleSm, { color: textColor }]}>{title}</Text>
      {subtitle ? (
        <Text style={[Typography.caption, { color: textSecondary }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

function LoadingPlaceholder() {
  const primary = useThemeColor({}, "primary");

  return (
    <View style={styles.loadingRow}>
      <ActivityIndicator size="small" color={primary} />
    </View>
  );
}

function Divider() {
  const border = useThemeColor({}, "border");

  return <View style={[styles.divider, { backgroundColor: border }]} />;
}

function MetaPill({
  label,
  primary = false,
}: {
  label: string;
  primary?: boolean;
}) {
  const primarySurface = useThemeColor({}, "primarySurface");
  const borderSubtle = useThemeColor({}, "borderSubtle");
  const textSecondary = useThemeColor({}, "textSecondary");
  const primaryColor = useThemeColor({}, "primary");

  return (
    <View
      style={[
        styles.metaPill,
        { backgroundColor: primary ? primarySurface : borderSubtle },
      ]}
    >
      <Text
        style={[
          Typography.caption,
          { color: primary ? primaryColor : textSecondary },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function RecordRow({
  label,
  value,
  dateLabel,
}: {
  label: string;
  value: string;
  dateLabel: string;
}) {
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const primary = useThemeColor({}, "primary");

  return (
    <View style={styles.recordRow}>
      <View style={styles.recordRowMain}>
        <Text style={[Typography.label, { color: primary }]}>{label}</Text>
        <Text
          style={[
            Typography.displaySm,
            styles.recordValue,
            { color: textColor },
          ]}
        >
          {value}
        </Text>
      </View>
      <Text
        style={[
          Typography.caption,
          styles.recordDate,
          { color: textSecondary },
        ]}
      >
        {dateLabel}
      </Text>
    </View>
  );
}

function CompactStat({ label, value }: { label: string; value: string }) {
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");

  return (
    <View style={styles.compactStat}>
      <Text style={[Typography.caption, { color: textSecondary }]}>
        {label}
      </Text>
      <Text style={[Typography.titleMd, { color: textColor }]}>{value}</Text>
    </View>
  );
}

function SessionRow({
  session,
  setLabel,
  completedSetsLabel,
}: {
  session: ExerciseSessionHistory;
  setLabel: (number: number) => string;
  completedSetsLabel: string;
}) {
  const border = useThemeColor({}, "border");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const primary = useThemeColor({}, "primary");

  const sets = session.sets ?? [];

  return (
    <View style={[styles.sessionRow, { borderBottomColor: border }]}>
      <View style={styles.sessionHeader}>
        <View style={styles.sessionTitleWrap}>
          <Text
            style={[
              Typography.titleMd,
              styles.sessionTitle,
              { color: textColor },
            ]}
            numberOfLines={2}
          >
            {session.workout_name}
          </Text>
          <Text style={[Typography.caption, { color: textMuted }]}>
            {completedSetsLabel}
          </Text>
        </View>
        <Text
          style={[Typography.micro, styles.sessionDate, { color: primary }]}
        >
          {formatShortDate(session.date)}
        </Text>
      </View>

      <View style={styles.setList}>
        {sets.map((set) => (
          <View key={set.set_number} style={styles.setRow}>
            <Text style={[Typography.caption, { color: textSecondary }]}>
              {setLabel(set.set_number)}
            </Text>
            <Text
              style={[
                Typography.bodyMedium,
                styles.setValue,
                { color: textColor },
              ]}
            >
              {formatValue(set.load_kg, "kg")} x {set.reps ?? "-"}
              {set.rpe != null ? ` @${set.rpe}` : ""}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function ExerciseDetailScreen() {
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  const { t } = useTranslation("exerciseDetail");

  const background = useThemeColor({}, "background");
  const backgroundSubtle = useThemeColor({}, "backgroundSubtle");
  const border = useThemeColor({}, "border");
  const textColor = useThemeColor({}, "text");
  const textMuted = useThemeColor({}, "textMuted");
  const textSecondary = useThemeColor({}, "textSecondary");

  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const { data: exercise } = useExercise(exerciseId ?? "");
  const { data: detail, isLoading: detailLoading } = useExerciseDetail(
    exerciseId ?? ""
  );

  const sessions = useMemo(
    () =>
      (detail?.sessions ?? []).filter(
        (session) => Array.isArray(session.sets) && session.sets.length > 0
      ),
    [detail?.sessions]
  );

  const tabOptions = [
    { key: "overview", label: t("tabs.overview") },
    { key: "history", label: t("tabs.history") },
    { key: "howTo", label: t("tabs.howTo") },
  ];

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab as Tab);
  }, []);

  const handleSwipe = useCallback((direction: "left" | "right") => {
    setActiveTab((current) => {
      const currentIndex = TAB_ORDER.indexOf(current);
      const nextIndex =
        direction === "right"
          ? Math.min(TAB_ORDER.length - 1, currentIndex + 1)
          : Math.max(0, currentIndex - 1);

      return TAB_ORDER[nextIndex];
    });
  }, []);

  const swipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .activeOffsetX([-24, 24])
        .failOffsetY([-14, 14])
        .onEnd(({ translationX, velocityX }) => {
          if (translationX > 48 || velocityX > 650) {
            handleSwipe("right");
            return;
          }

          if (translationX < -48 || velocityX < -650) {
            handleSwipe("left");
          }
        }),
    [handleSwipe]
  );

  const renderOverview = () => {
    if (detailLoading) {
      return <LoadingPlaceholder />;
    }

    const records = detail?.records;

    return (
      <View style={styles.sectionStack}>
        {exercise ? (
          <View style={styles.introSection}>
            <View style={styles.introHeader}>
              <View style={styles.introText}>
                <Text
                  style={[
                    Typography.displaySm,
                    styles.exerciseName,
                    { color: textColor },
                  ]}
                >
                  {exercise.name}
                </Text>
                <Text style={[Typography.body, { color: textSecondary }]}>
                  {t("overview.recordsHint")}
                </Text>
              </View>
              <Text
                style={[
                  Typography.micro,
                  styles.sessionCount,
                  { color: textMuted },
                ]}
              >
                {t("overview.sessionsCount", { count: sessions.length })}
              </Text>
            </View>

            <View style={styles.metaPillRow}>
              {exercise.primary_muscles.map((muscle) => (
                <MetaPill key={muscle} label={muscle} primary />
              ))}
              {(exercise.secondary_muscles ?? []).map((muscle) => (
                <MetaPill key={muscle} label={muscle} />
              ))}
            </View>
          </View>
        ) : null}

        <Divider />

        <View style={styles.sectionBlock}>
          <SectionTitle title={t("overview.records")} />
          {hasAnyRecord(records) ? (
            <View style={styles.recordList}>
              <RecordRow
                label={t("overview.maxWeight")}
                value={formatValue(records?.max_weight_kg, "kg")}
                dateLabel={getAchievedLabel(t, records?.max_weight_date)}
              />
              <Divider />
              <RecordRow
                label={t("overview.maxReps")}
                value={formatValue(records?.max_reps)}
                dateLabel={getAchievedLabel(t, records?.max_reps_date)}
              />
              <Divider />
              <RecordRow
                label={t("overview.bestSet")}
                value={formatValue(records?.max_volume_set_kg, "kg")}
                dateLabel={getAchievedLabel(t, records?.max_volume_set_date)}
              />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text
                style={[
                  Typography.body,
                  styles.emptyText,
                  { color: textMuted },
                ]}
              >
                {t("overview.noData")}
              </Text>
            </View>
          )}
        </View>

        <Divider />

        <View style={styles.sectionBlock}>
          <View style={styles.compactStatRow}>
            <CompactStat
              label={t("overview.est1rm")}
              value={formatValue(records?.est_1rm_kg, "kg")}
            />
            <CompactStat
              label={t("overview.maxRpe")}
              value={formatValue(records?.max_rpe)}
            />
          </View>
        </View>

        <Divider />

        <View style={styles.sectionBlock}>
          <SectionTitle title={t("overview.volume")} />
          {detail?.volume_weeks && detail.volume_weeks.length > 0 ? (
            <VolumeBarChart data={detail.volume_weeks} />
          ) : (
            <View style={styles.emptyState}>
              <Text
                style={[
                  Typography.body,
                  styles.emptyText,
                  { color: textMuted },
                ]}
              >
                {t("overview.noData")}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderHistory = () => {
    if (detailLoading) {
      return <LoadingPlaceholder />;
    }

    if (sessions.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text
            style={[Typography.body, styles.emptyText, { color: textMuted }]}
          >
            {t("history.noSessions")}
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.sectionStack}>
        {sessions.map((session) => (
          <SessionRow
            key={`${session.date}-${session.workout_name}-${session.sets?.length ?? 0}`}
            session={session}
            setLabel={(number) => t("history.set", { number })}
            completedSetsLabel={t("history.completedSets", {
              count: session.sets?.length ?? 0,
            })}
          />
        ))}
      </View>
    );
  };

  const renderHowTo = () => {
    const instructions = exercise?.instructions;

    return (
      <View style={styles.sectionStack}>
        <SectionTitle title={t("howTo.instructions")} />
        <Text
          style={[Typography.body, styles.instructions, { color: textColor }]}
        >
          {instructions || t("howTo.noInstructions")}
        </Text>
        {!instructions ? (
          <Text style={[Typography.caption, { color: textMuted }]}>
            {t("howTo.todo")}
          </Text>
        ) : null}
      </View>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: background }]}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
          <ScreenHeader title={exercise?.name ?? ""} numberOfLines={2} />
          <GestureDetector gesture={swipeGesture}>
            <ScrollView
              contentContainerStyle={styles.scroll}
              showsVerticalScrollIndicator={false}
            >
              <PeriodSelector
                selected={activeTab}
                onChange={handleTabChange}
                periods={tabOptions}
              />

              {activeTab === "overview" ? renderOverview() : null}
              {activeTab === "history" ? renderHistory() : null}
              {activeTab === "howTo" ? renderHowTo() : null}
            </ScrollView>
          </GestureDetector>
        </SafeAreaView>
      </SafeAreaProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing["4xl"],
    gap: Spacing.xl,
  },
  tabsWrap: {
    borderRadius: Radii.full,
    borderWidth: 1,
    padding: 4,
  },
  sectionStack: {
    gap: Spacing.lg,
  },
  sectionBlock: {
    gap: Spacing.lg,
  },
  sectionTitleWrap: {
    gap: 2,
  },
  introSection: {
    gap: Spacing.md,
  },
  introHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: Spacing.md,
  },
  introText: {
    flex: 1,
    gap: Spacing.xs,
  },
  exerciseName: {
    lineHeight: 28,
  },
  sessionCount: {
    paddingTop: 2,
  },
  metaPillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  metaPill: {
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  divider: {
    height: 1,
    width: "100%",
  },
  recordList: {
    gap: Spacing.md,
  },
  recordRow: {
    gap: Spacing.xs,
  },
  recordRowMain: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: Spacing.md,
  },
  recordValue: {
    textAlign: "right",
    lineHeight: 24,
  },
  recordDate: {
    textAlign: "right",
  },
  compactStatRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.lg,
  },
  compactStat: {
    flex: 1,
    gap: Spacing.xs,
  },
  chartWrap: {
    borderRadius: 18,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
  },
  loadingRow: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["3xl"],
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["2xl"],
  },
  emptyText: {
    textAlign: "center",
  },
  sessionRow: {
    gap: Spacing.md,
    borderBottomWidth: 1,
    paddingBottom: Spacing.lg,
  },
  sessionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  sessionTitleWrap: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  sessionTitle: {
    flexShrink: 1,
  },
  sessionDate: {
    flexShrink: 0,
    textAlign: "right",
  },
  setList: {
    gap: Spacing.sm,
  },
  setRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: Spacing.md,
  },
  setValue: {
    flexShrink: 1,
    textAlign: "right",
  },
  instructions: {
    lineHeight: 22,
  },
});
