import { useLocalSearchParams, useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { ExerciseImage } from "@/components/exercise/exercise-image";
import { ExercisePreferenceIcon } from "@/components/exercise/exercise-preference-icon";
import { ExercisePreferenceSheet } from "@/components/exercise/exercise-preference-sheet";
import { PeriodSelector } from "@/components/stats/period-selector";
import { VolumeBarChart } from "@/components/stats/volume-bar-chart";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { useExerciseDetail } from "@/hooks/use-exercise-detail-query";
import {
  useRemoveExercisePreference,
  useSetExercisePreference,
} from "@/hooks/use-exercise-preference-mutations";
import { useExercisePreference } from "@/hooks/use-exercise-preference-query";
import { useExercise } from "@/hooks/use-exercises-query";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useWeightUnit } from "@/hooks/use-weight-unit";
import type {
  ExerciseDetailStats,
  ExerciseSessionHistory,
} from "@/lib/api/exercise-detail";
import { formatExerciseDuration } from "@/lib/format-exercise-duration";

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
  const parsedDate = parseDisplayDate(date);
  if (!parsedDate) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsedDate);
}

function formatShortDate(date: string): string | null {
  const parsedDate = parseDisplayDate(date);
  if (!parsedDate) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsedDate);
}

function parseDisplayDate(date: string | null | undefined): Date | null {
  if (!date) {
    return null;
  }

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const parsedDate = dateOnlyMatch
    ? new Date(
        Number(dateOnlyMatch[1]!),
        Number(dateOnlyMatch[2]!) - 1,
        Number(dateOnlyMatch[3]!)
      )
    : new Date(date);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
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

function hasAnyRecord(
  records: ExerciseDetailStats | undefined,
  isTimeExercise = false
): boolean {
  if (!records) return false;
  if (isTimeExercise) {
    return (records.max_duration_seconds ?? 0) > 0;
  }
  return (
    records.max_weight_kg > 0 ||
    records.max_reps > 0 ||
    records.max_volume_set_kg > 0
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

function ErrorState({
  title,
  message,
  retryLabel,
  onRetry,
}: {
  title: string;
  message: string;
  retryLabel: string;
  onRetry?: () => void;
}) {
  const textColor = useThemeColor({}, "text");
  const textMuted = useThemeColor({}, "textMuted");
  const primary = useThemeColor({}, "primary");
  const primarySurface = useThemeColor({}, "primarySurface");

  return (
    <View style={styles.emptyState}>
      <Text
        style={[Typography.titleSm, styles.emptyText, { color: textColor }]}
      >
        {title}
      </Text>
      <Text style={[Typography.body, styles.emptyText, { color: textMuted }]}>
        {message}
      </Text>
      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={[styles.retryButton, { backgroundColor: primarySurface }]}
        >
          <Text style={[Typography.label, { color: primary }]}>
            {retryLabel}
          </Text>
        </Pressable>
      ) : null}
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
  isTimeExercise,
  wu,
}: {
  session: ExerciseSessionHistory;
  setLabel: (number: number) => string;
  completedSetsLabel: string;
  isTimeExercise: boolean;
  wu: ReturnType<typeof useWeightUnit>;
}) {
  const border = useThemeColor({}, "border");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const primary = useThemeColor({}, "primary");

  const sets = session.sets ?? [];
  const formattedDate = formatShortDate(session.date);

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
          {formattedDate ?? session.date}
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
              {isTimeExercise && set.duration_seconds
                ? formatExerciseDuration(set.duration_seconds)
                : `${set.load_kg != null ? wu.format(set.load_kg) : "-"} x ${
                    set.reps ?? "-"
                  }`}
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
  const router = useRouter();
  const { t } = useTranslation("exerciseDetail");

  const background = useThemeColor({}, "background");
  const primary = useThemeColor({}, "primary");
  const textColor = useThemeColor({}, "text");
  const textMuted = useThemeColor({}, "textMuted");
  const textSecondary = useThemeColor({}, "textSecondary");

  const wu = useWeightUnit();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [prefSheetVisible, setPrefSheetVisible] = useState(false);
  const [pagerWidth, setPagerWidth] = useState(0);
  const [tabHeights, setTabHeights] = useState<Record<Tab, number>>({
    overview: 0,
    history: 0,
    howTo: 0,
  });
  const tabOffsetX = useSharedValue(0);
  const tabDragX = useSharedValue(0);

  const {
    data: exercise,
    isLoading: exerciseLoading,
    isError: exerciseError,
    refetch: refetchExercise,
  } = useExercise(exerciseId ?? "");
  const {
    data: detail,
    isLoading: detailLoading,
    isError: detailError,
    refetch: refetchDetail,
  } = useExerciseDetail(exerciseId ?? "");
  const { data: preference } = useExercisePreference(exerciseId ?? "");
  const setPreferenceMutation = useSetExercisePreference();
  const removePreferenceMutation = useRemoveExercisePreference();

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
  const activeTabIndex = TAB_ORDER.indexOf(activeTab);
  const activeTabHeight = tabHeights[activeTab];
  const activeTabIndexRef = useRef(activeTabIndex);
  const pagerHeight = useSharedValue(0);

  activeTabIndexRef.current = activeTabIndex;

  useEffect(() => {
    if (pagerWidth <= 0) {
      return;
    }

    tabDragX.value = 0;
    tabOffsetX.value = -activeTabIndexRef.current * pagerWidth;
  }, [pagerWidth, tabDragX, tabOffsetX]);

  useEffect(() => {
    if (activeTabHeight <= 0) {
      return;
    }

    pagerHeight.value = withTiming(activeTabHeight, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
    });
  }, [activeTabHeight, pagerHeight]);

  const handlePagerLayout = useCallback((event: LayoutChangeEvent) => {
    setPagerWidth(event.nativeEvent.layout.width);
  }, []);

  const handleTabPanelLayout = useCallback(
    (tab: Tab, event: LayoutChangeEvent) => {
      const nextHeight = Math.ceil(event.nativeEvent.layout.height);
      setTabHeights((current) => {
        if (current[tab] === nextHeight) {
          return current;
        }

        return { ...current, [tab]: nextHeight };
      });
    },
    []
  );

  const animateTabChange = useCallback(
    (nextTab: Tab) => {
      const nextIndex = TAB_ORDER.indexOf(nextTab);

      if (activeTabIndex === nextIndex || nextIndex === -1) {
        return;
      }

      if (pagerWidth <= 0) {
        setActiveTab(nextTab);
        return;
      }

      const currentVisualOffset = tabOffsetX.value + tabDragX.value;
      tabDragX.value = 0;
      tabOffsetX.value = currentVisualOffset;
      setActiveTab(nextTab);
      const nextHeight = tabHeights[nextTab] || activeTabHeight;
      if (nextHeight > 0) {
        pagerHeight.value = withTiming(nextHeight, {
          duration: 220,
          easing: Easing.out(Easing.cubic),
        });
      }
      tabOffsetX.value = withTiming(-nextIndex * pagerWidth, {
        duration: 240,
        easing: Easing.out(Easing.cubic),
      });
    },
    [
      activeTabHeight,
      activeTabIndex,
      pagerHeight,
      pagerWidth,
      tabDragX,
      tabHeights,
      tabOffsetX,
    ]
  );

  const handleTabChange = useCallback(
    (tab: string) => {
      if (!TAB_ORDER.includes(tab as Tab)) {
        return;
      }

      animateTabChange(tab as Tab);
    },
    [animateTabChange]
  );

  const handleSwipe = useCallback(
    (direction: "left" | "right") => {
      const nextIndex =
        direction === "left"
          ? Math.min(TAB_ORDER.length - 1, activeTabIndex + 1)
          : Math.max(0, activeTabIndex - 1);
      const nextTab = TAB_ORDER[nextIndex];

      if (nextTab && nextIndex !== activeTabIndex) {
        animateTabChange(nextTab);
        return;
      }

      tabDragX.value = withTiming(0, {
        duration: 180,
        easing: Easing.out(Easing.cubic),
      });
      if (activeTabHeight > 0) {
        pagerHeight.value = withTiming(activeTabHeight, {
          duration: 180,
          easing: Easing.out(Easing.cubic),
        });
      }
    },
    [activeTabHeight, activeTabIndex, animateTabChange, pagerHeight, tabDragX]
  );

  const pagerRowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tabOffsetX.value + tabDragX.value }],
  }));
  const pagerViewportStyle = useAnimatedStyle(() => ({
    height: pagerHeight.value,
  }));

  const swipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .activeOffsetX([-24, 24])
        .failOffsetY([-14, 14])
        .onUpdate(({ translationX }) => {
          const isAtStart = activeTabIndex === 0;
          const isAtEnd = activeTabIndex === TAB_ORDER.length - 1;
          const isPullingPastStart = isAtStart && translationX > 0;
          const isPullingPastEnd = isAtEnd && translationX < 0;
          const resistance = isPullingPastStart || isPullingPastEnd ? 0.18 : 1;

          tabDragX.value = Math.max(
            -pagerWidth,
            Math.min(pagerWidth, translationX * resistance)
          );

          const targetIndex =
            translationX < 0
              ? Math.min(TAB_ORDER.length - 1, activeTabIndex + 1)
              : Math.max(0, activeTabIndex - 1);
          const targetTab = TAB_ORDER[targetIndex];
          const targetHeight = targetTab
            ? tabHeights[targetTab] || activeTabHeight
            : activeTabHeight;

          if (activeTabHeight > 0 && targetHeight > 0 && pagerWidth > 0) {
            const progress = Math.min(1, Math.abs(translationX) / pagerWidth);
            pagerHeight.value =
              activeTabHeight + (targetHeight - activeTabHeight) * progress;
          }
        })
        .onEnd(({ translationX, velocityX }) => {
          if (translationX > 48 || velocityX > 650) {
            handleSwipe("right");
            return;
          }

          if (translationX < -48 || velocityX < -650) {
            handleSwipe("left");
            return;
          }

          tabDragX.value = withTiming(0, {
            duration: 180,
            easing: Easing.out(Easing.cubic),
          });
          if (activeTabHeight > 0) {
            pagerHeight.value = withTiming(activeTabHeight, {
              duration: 180,
              easing: Easing.out(Easing.cubic),
            });
          }
        }),
    [
      activeTabHeight,
      activeTabIndex,
      handleSwipe,
      pagerHeight,
      pagerWidth,
      tabDragX,
      tabHeights,
    ]
  );

  const renderOverview = () => {
    if (!exerciseId) {
      return (
        <ErrorState
          title={t("error.title")}
          message={t("error.missingExercise")}
          retryLabel={t("error.retry")}
        />
      );
    }

    if (detailLoading) {
      return <LoadingPlaceholder />;
    }

    if (detailError) {
      return (
        <ErrorState
          title={t("error.title")}
          message={t("error.detail")}
          retryLabel={t("error.retry")}
          onRetry={() => {
            refetchDetail();
          }}
        />
      );
    }

    const records = detail?.records;
    const isTimeExercise =
      (detail?.exercise_type ?? exercise?.exercise_type) === "time";
    const hasRecordData = hasAnyRecord(records, isTimeExercise);
    const hasVolumeData =
      detail?.volume_weeks?.some((week) =>
        isTimeExercise
          ? (week.total_duration_seconds ?? 0) > 0
          : week.volume_kg > 0
      ) ?? false;
    const hasTrackedData =
      hasRecordData || hasVolumeData || sessions.length > 0;

    const renderIntro = () =>
      exercise ? (
        <View style={styles.introSection}>
          <View style={styles.metaPillRow}>
            {sessions.length > 0 ? (
              <MetaPill
                label={t("overview.sessionsCount", {
                  count: sessions.length,
                })}
              />
            ) : null}
            {exercise.primary_muscles.map((muscle, index) => (
              <MetaPill
                key={muscle}
                label={exercise.primary_muscle_labels[index] ?? muscle}
                primary
              />
            ))}
            {(exercise.secondary_muscles ?? []).map((muscle, index) => (
              <MetaPill
                key={muscle}
                label={exercise.secondary_muscle_labels[index] ?? muscle}
              />
            ))}
          </View>
        </View>
      ) : null;

    if (!hasTrackedData) {
      return (
        <View style={styles.sectionStack}>
          {renderIntro()}
          <View style={styles.emptyOverview}>
            <Text
              style={[
                Typography.titleMd,
                styles.emptyText,
                { color: textColor },
              ]}
            >
              {t("overview.emptyTitle")}
            </Text>
            <Text
              style={[
                Typography.body,
                styles.emptyText,
                { color: textSecondary },
              ]}
            >
              {t("overview.emptyBody")}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/generate-workout")}
              style={[styles.primaryButton, { backgroundColor: primary }]}
            >
              <Text style={[Typography.label, styles.primaryButtonText]}>
                {t("overview.emptyAction")}
              </Text>
            </Pressable>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.sectionStack}>
        {renderIntro()}

        {hasRecordData ? (
          <>
            <Divider />
            <View style={styles.sectionBlock}>
              <SectionTitle title={t("overview.records")} />
              {hasTrackedData ? (
                <Text style={[Typography.body, { color: textSecondary }]}>
                  {t("overview.recordsHint")}
                </Text>
              ) : null}
              <View style={styles.recordList}>
                {isTimeExercise ? (
                  <RecordRow
                    label={t("overview.bestDuration")}
                    value={
                      records?.max_duration_seconds != null
                        ? formatExerciseDuration(records.max_duration_seconds)
                        : "-"
                    }
                    dateLabel={getAchievedLabel(t, records?.max_duration_date)}
                  />
                ) : (
                  <>
                    <RecordRow
                      label={t("overview.maxWeight")}
                      value={
                        records?.max_weight_kg
                          ? wu.format(records.max_weight_kg)
                          : "-"
                      }
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
                      value={
                        records?.max_volume_set_kg
                          ? wu.format(records.max_volume_set_kg)
                          : "-"
                      }
                      dateLabel={getAchievedLabel(
                        t,
                        records?.max_volume_set_date
                      )}
                    />
                  </>
                )}
              </View>
            </View>
          </>
        ) : null}

        {!isTimeExercise && (records?.est_1rm_kg || records?.max_rpe) ? (
          <>
            <Divider />
            <View style={styles.sectionBlock}>
              <View style={styles.compactStatRow}>
                <CompactStat
                  label={t("overview.est1rm")}
                  value={
                    records?.est_1rm_kg ? wu.format(records.est_1rm_kg) : "-"
                  }
                />
                <CompactStat
                  label={t("overview.maxRpe")}
                  value={formatValue(records?.max_rpe)}
                />
              </View>
            </View>
          </>
        ) : null}

        {hasVolumeData && detail?.volume_weeks ? (
          <>
            <Divider />
            <View style={styles.sectionBlock}>
              <SectionTitle title={t("overview.volume")} />
              <VolumeBarChart
                data={detail.volume_weeks}
                metric={isTimeExercise ? "duration" : "volume"}
                labels={{
                  total: isTimeExercise
                    ? t("overview.durationTotal")
                    : t("overview.volumeTotal"),
                  average: isTimeExercise
                    ? t("overview.durationWeeklyAvg")
                    : t("overview.volumeWeeklyAvg"),
                  perWeek: t("overview.perWeek"),
                }}
              />
            </View>
          </>
        ) : null}
      </View>
    );
  };

  const renderHistory = () => {
    if (!exerciseId) {
      return (
        <ErrorState
          title={t("error.title")}
          message={t("error.missingExercise")}
          retryLabel={t("error.retry")}
        />
      );
    }

    if (detailLoading) {
      return <LoadingPlaceholder />;
    }

    if (detailError) {
      return (
        <ErrorState
          title={t("error.title")}
          message={t("error.detail")}
          retryLabel={t("error.retry")}
          onRetry={() => {
            refetchDetail();
          }}
        />
      );
    }

    const isTimeExercise =
      (detail?.exercise_type ?? exercise?.exercise_type) === "time";

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
            isTimeExercise={isTimeExercise}
            wu={wu}
          />
        ))}
      </View>
    );
  };

  const renderHowTo = () => {
    if (!exerciseId) {
      return (
        <ErrorState
          title={t("error.title")}
          message={t("error.missingExercise")}
          retryLabel={t("error.retry")}
        />
      );
    }

    if (exerciseLoading) {
      return <LoadingPlaceholder />;
    }

    if (exerciseError) {
      return (
        <ErrorState
          title={t("error.title")}
          message={t("error.exercise")}
          retryLabel={t("error.retry")}
          onRetry={() => {
            refetchExercise();
          }}
        />
      );
    }

    const instructions = exercise?.instructions;

    return (
      <View style={styles.sectionStack}>
        {exercise ? (
          <ExerciseImage
            image={exercise.image}
            exerciseName={exercise.name}
            size="hero"
          />
        ) : null}
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
          <ScreenHeader
            title={exercise?.name ?? ""}
            numberOfLines={2}
            rightElement={
              <Pressable
                onPress={() => setPrefSheetVisible(true)}
                disabled={!exerciseId || !exercise}
                accessibilityRole="button"
                accessibilityLabel={t("header.accessibilityLabel", {
                  ns: "exercisePreference",
                })}
                hitSlop={8}
                style={!exerciseId || !exercise ? styles.disabledAction : null}
              >
                <ExercisePreferenceIcon preference={preference ?? null} />
              </Pressable>
            }
          />
          <GestureDetector gesture={swipeGesture}>
            <ScrollView
              contentContainerStyle={styles.scroll}
              showsVerticalScrollIndicator={false}
            >
              <PeriodSelector
                selected={activeTab}
                onChange={handleTabChange}
                periods={tabOptions}
                compact
              />

              <Animated.View
                onLayout={handlePagerLayout}
                style={[
                  styles.pagerViewport,
                  activeTabHeight > 0 ? { minHeight: activeTabHeight } : null,
                  pagerViewportStyle,
                ]}
              >
                <Animated.View
                  style={[
                    styles.pagerRow,
                    pagerWidth > 0
                      ? { width: pagerWidth * TAB_ORDER.length }
                      : null,
                    pagerRowStyle,
                  ]}
                >
                  <View
                    style={[
                      styles.pagerPanel,
                      {
                        width: pagerWidth,
                        minHeight: activeTabHeight || undefined,
                      },
                    ]}
                  >
                    <View
                      onLayout={(event) =>
                        handleTabPanelLayout("overview", event)
                      }
                    >
                      {renderOverview()}
                    </View>
                  </View>
                  <View
                    style={[
                      styles.pagerPanel,
                      {
                        width: pagerWidth,
                        minHeight: activeTabHeight || undefined,
                      },
                    ]}
                  >
                    <View
                      onLayout={(event) =>
                        handleTabPanelLayout("history", event)
                      }
                    >
                      {renderHistory()}
                    </View>
                  </View>
                  <View
                    style={[
                      styles.pagerPanel,
                      {
                        width: pagerWidth,
                        minHeight: activeTabHeight || undefined,
                      },
                    ]}
                  >
                    <View
                      onLayout={(event) => handleTabPanelLayout("howTo", event)}
                    >
                      {renderHowTo()}
                    </View>
                  </View>
                </Animated.View>
              </Animated.View>
            </ScrollView>
          </GestureDetector>
          <ExercisePreferenceSheet
            visible={prefSheetVisible}
            exerciseName={exercise?.name ?? ""}
            currentPreference={preference ?? null}
            onClose={() => setPrefSheetVisible(false)}
            onSelect={(pref) => {
              if (pref === null) {
                if (exerciseId) {
                  removePreferenceMutation.mutate(exerciseId);
                }
              } else {
                if (exerciseId) {
                  setPreferenceMutation.mutate({
                    exerciseId,
                    preference: pref,
                  });
                }
              }
            }}
          />
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
  pagerViewport: {
    overflow: "hidden",
    width: "100%",
  },
  pagerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  pagerPanel: {
    flexShrink: 0,
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
  emptyOverview: {
    alignItems: "center",
    gap: Spacing.md,
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing["4xl"],
  },
  emptyText: {
    textAlign: "center",
  },
  primaryButton: {
    borderRadius: Radii.full,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  primaryButtonText: {
    color: "#FFFFFF",
  },
  retryButton: {
    borderRadius: Radii.full,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  disabledAction: {
    opacity: 0.4,
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
