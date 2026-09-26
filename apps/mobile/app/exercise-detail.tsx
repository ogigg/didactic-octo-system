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
  Alert,
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
import { ExerciseHistoryEditSheet } from "@/components/history/exercise-history-edit-sheet";
import { ExerciseHistoryMenu } from "@/components/history/exercise-history-menu";
import { PeriodSelector } from "@/components/stats/period-selector";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ExerciseInsights } from "@/components/stats/exercise-insights";
import { VolumeBarChart } from "@/components/stats/volume-bar-chart";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Radii, Spacing, Typography } from "@/constants/theme";
import {
  useEditableExerciseHistory,
  useExerciseDetail,
} from "@/hooks/use-exercise-detail-query";
import {
  useRemoveExercisePreference,
  useSetExercisePreference,
} from "@/hooks/use-exercise-preference-mutations";
import { useExercisePreference } from "@/hooks/use-exercise-preference-query";
import {
  useAppCatalogLanguage,
  useExercise,
} from "@/hooks/use-exercises-query";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useWeightUnit } from "@/hooks/use-weight-unit";
import {
  useDeleteSessionExercise,
  useUpdateCompletedSessionExerciseSets,
} from "@/hooks/use-workout-mutations";
import {
  getExerciseWeekMetrics,
  type ExerciseDetailStats,
} from "@/lib/api/exercise-detail";
import type {
  CompletedExerciseSetInput,
  EditableExerciseHistory,
} from "@/lib/api/workouts";
import { formatExerciseDuration } from "@/lib/format-exercise-duration";
import { getExerciseChartProgress } from "@/lib/exercise-chart-progress";
import { useWorkoutStore } from "@/stores/workout-store";
import { useToastStore } from "@/stores/toast-store";

type Tab = "overview" | "history" | "howTo";

const TAB_ORDER: Tab[] = ["overview", "history", "howTo"];

function getDefaultExerciseDetailTab(hasExecutionHistory: boolean): Tab {
  return hasExecutionHistory ? "overview" : "howTo";
}

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

function formatLongDate(
  date: string | null | undefined,
  locale: string
): string | null {
  const parsedDate = parseDisplayDate(date);
  if (!parsedDate) {
    return null;
  }

  return new Intl.DateTimeFormat(locale, {
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
  t: (key: string, options?: Record<string, string>) => string,
  date: string | null | undefined,
  locale: string
): string {
  const formattedDate = formatLongDate(date, locale);

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
  menuAccessibilityLabel,
  onOpenMenu,
}: {
  session: EditableExerciseHistory;
  setLabel: (number: number) => string;
  completedSetsLabel: string;
  isTimeExercise: boolean;
  wu: ReturnType<typeof useWeightUnit>;
  menuAccessibilityLabel: string;
  onOpenMenu: () => void;
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
        <View style={styles.sessionPrimaryRow}>
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
          <Text
            style={[Typography.micro, styles.sessionDate, { color: primary }]}
          >
            {formattedDate ?? session.date}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={menuAccessibilityLabel}
            hitSlop={8}
            onPress={onOpenMenu}
            style={styles.sessionMenuButton}
          >
            <IconSymbol name="ellipsis" size={20} color={textSecondary} />
          </Pressable>
        </View>
        <Text style={[Typography.caption, { color: textMuted }]}>
          {completedSetsLabel}
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

interface ExerciseDetailScreenProps {
  fullStatistics?: boolean;
}

export default function ExerciseDetailScreen({
  fullStatistics = false,
}: ExerciseDetailScreenProps) {
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  const router = useRouter();
  const { t } = useTranslation("exerciseDetail");
  const { t: tHistory } = useTranslation("history");
  const locale = useAppCatalogLanguage();
  const showSuccess = useToastStore((state) => state.showSuccess);
  const tString = useCallback(
    (key: string, options?: Record<string, string>) =>
      String(
        (
          t as unknown as (
            key: string,
            options?: Record<string, string>
          ) => unknown
        )(key, options)
      ),
    [t]
  );

  const background = useThemeColor({}, "background");
  const primary = useThemeColor({}, "primary");
  const textColor = useThemeColor({}, "text");
  const textMuted = useThemeColor({}, "textMuted");
  const textSecondary = useThemeColor({}, "textSecondary");

  const wu = useWeightUnit();
  const workoutActive = useWorkoutStore((state) => state.isActive);
  const workoutExercises = useWorkoutStore((state) => state.exercises);
  const workoutWeightUnit = useWorkoutStore((state) => state.weightUnit);
  const todayProgress = useMemo(
    () =>
      workoutActive
        ? getExerciseChartProgress(
            workoutExercises,
            exerciseId ?? "",
            workoutWeightUnit
          )
        : undefined,
    [workoutActive, workoutExercises, exerciseId, workoutWeightUnit]
  );
  const [activeTab, setActiveTab] = useState<Tab | null>(null);
  const [prefSheetVisible, setPrefSheetVisible] = useState(false);
  const [selectedHistory, setSelectedHistory] =
    useState<EditableExerciseHistory | null>(null);
  const [historyMenuVisible, setHistoryMenuVisible] = useState(false);
  const [historyEditorVisible, setHistoryEditorVisible] = useState(false);
  const [pagerWidth, setPagerWidth] = useState(0);
  const [tabHeights, setTabHeights] = useState<Record<Tab, number>>({
    overview: 0,
    history: 0,
    howTo: 0,
  });
  const tabOffsetX = useSharedValue(0);
  const tabDragX = useSharedValue(0);
  const hasResolvedDefaultTabRef = useRef(false);
  const hasUserSelectedTabRef = useRef(false);

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
  const {
    data: editableHistory,
    isLoading: editableHistoryLoading,
    isError: editableHistoryError,
    refetch: refetchEditableHistory,
  } = useEditableExerciseHistory(exerciseId ?? "");
  const { data: preference } = useExercisePreference(exerciseId ?? "");
  const setPreferenceMutation = useSetExercisePreference();
  const removePreferenceMutation = useRemoveExercisePreference();
  const deleteSessionExerciseMutation = useDeleteSessionExercise();
  const updateExerciseSetsMutation = useUpdateCompletedSessionExerciseSets();

  const sessions = useMemo(
    () =>
      (detail?.sessions ?? []).filter(
        (session) => Array.isArray(session.sets) && session.sets.length > 0
      ),
    [detail?.sessions]
  );

  const handleDeleteHistory = useCallback(() => {
    if (!selectedHistory) return;
    const exerciseName = exercise?.name ?? "";

    Alert.alert(
      tHistory("detail.deleteExercise.confirmTitle"),
      tHistory("detail.deleteExercise.confirmMessage", { exerciseName }),
      [
        { text: tHistory("detail.deleteExercise.cancel"), style: "cancel" },
        {
          text: tHistory("detail.deleteExercise.remove"),
          style: "destructive",
          onPress: () =>
            deleteSessionExerciseMutation.mutate(selectedHistory.id, {
              onSuccess: () =>
                showSuccess(tHistory("detail.deleteExercise.success")),
              onError: () =>
                Alert.alert(
                  tHistory("detail.deleteExercise.errorTitle"),
                  tHistory("detail.deleteExercise.errorMessage")
                ),
            }),
        },
      ]
    );
  }, [
    deleteSessionExerciseMutation,
    exercise?.name,
    selectedHistory,
    showSuccess,
    tHistory,
  ]);

  const handleSaveHistory = useCallback(
    async (sets: CompletedExerciseSetInput[]) => {
      if (!selectedHistory) return;
      try {
        await updateExerciseSetsMutation.mutateAsync({
          sessionExerciseId: selectedHistory.id,
          sets,
        });
        showSuccess(tHistory("detail.exerciseEditor.success"));
      } catch (error) {
        Alert.alert(
          tHistory("detail.exerciseEditor.errorTitle"),
          tHistory("detail.exerciseEditor.errorMessage")
        );
        throw error;
      }
    },
    [selectedHistory, showSuccess, tHistory, updateExerciseSetsMutation]
  );

  useEffect(() => {
    hasResolvedDefaultTabRef.current = false;
    hasUserSelectedTabRef.current = false;
    setActiveTab(null);
  }, [exerciseId]);

  useEffect(() => {
    if (hasResolvedDefaultTabRef.current || hasUserSelectedTabRef.current) {
      return;
    }

    if (!exerciseId) {
      hasResolvedDefaultTabRef.current = true;
      setActiveTab("overview");
      return;
    }

    if (detailLoading) {
      return;
    }

    // Wait until the detail query settles so the first visible tab is final.
    if (detail === undefined && !detailError) {
      return;
    }

    const nextTab =
      detailError && detail === undefined
        ? "overview"
        : getDefaultExerciseDetailTab(sessions.length > 0);

    hasResolvedDefaultTabRef.current = true;
    setActiveTab(nextTab);
  }, [detail, detailError, detailLoading, exerciseId, sessions.length]);

  const tabOptions = [
    { key: "overview", label: t("tabs.overview") },
    { key: "history", label: t("tabs.history") },
    { key: "howTo", label: t("tabs.howTo") },
  ];
  const activeTabIndex = activeTab ? TAB_ORDER.indexOf(activeTab) : -1;
  const activeTabHeight = activeTab ? tabHeights[activeTab] : 0;
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

  const markTabSelectedByUser = useCallback(() => {
    hasUserSelectedTabRef.current = true;
    hasResolvedDefaultTabRef.current = true;
  }, []);

  const handleTabChange = useCallback(
    (tab: string) => {
      if (!TAB_ORDER.includes(tab as Tab)) {
        return;
      }

      markTabSelectedByUser();
      animateTabChange(tab as Tab);
    },
    [animateTabChange, markTabSelectedByUser]
  );

  const handleSwipe = useCallback(
    (direction: "left" | "right") => {
      if (activeTabIndex < 0) {
        return;
      }

      const nextIndex =
        direction === "left"
          ? Math.min(TAB_ORDER.length - 1, activeTabIndex + 1)
          : Math.max(0, activeTabIndex - 1);
      const nextTab = TAB_ORDER[nextIndex];

      if (nextTab && nextIndex !== activeTabIndex) {
        markTabSelectedByUser();
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
    [
      activeTabHeight,
      activeTabIndex,
      animateTabChange,
      markTabSelectedByUser,
      pagerHeight,
      tabDragX,
    ]
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
      hasRecordData || hasVolumeData || sessions.length > 0 || !!todayProgress;

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
                    dateLabel={getAchievedLabel(
                      tString,
                      records?.max_duration_date,
                      locale
                    )}
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
                      dateLabel={getAchievedLabel(
                        tString,
                        records?.max_weight_date,
                        locale
                      )}
                    />
                    <Divider />
                    <RecordRow
                      label={t("overview.maxReps")}
                      value={formatValue(records?.max_reps)}
                      dateLabel={getAchievedLabel(
                        tString,
                        records?.max_reps_date,
                        locale
                      )}
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
                        tString,
                        records?.max_volume_set_date,
                        locale
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

        {fullStatistics ? (
          <>
            <Divider />
            <ExerciseInsights sessions={sessions} isTime={isTimeExercise} />
          </>
        ) : null}

        {hasVolumeData || todayProgress ? (
          <>
            <Divider />
            <View style={styles.sectionBlock}>
              <View style={styles.chartHeader}>
                <Text
                  style={[
                    Typography.titleSm,
                    styles.chartTitle,
                    { color: textColor },
                  ]}
                >
                  {t("overview.volume")}
                </Text>
                {!fullStatistics ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("overview.seeFullStatistics")}
                    onPress={() =>
                      router.push({
                        pathname: "/exercise-statistics",
                        params: { exerciseId },
                      })
                    }
                    style={styles.statisticsLink}
                  >
                    <Text style={[Typography.caption, { color: primary }]}>
                      {t("overview.seeFullStatistics")}
                    </Text>
                    <IconSymbol
                      name="chevron.right"
                      size={12}
                      color={primary}
                    />
                  </Pressable>
                ) : null}
              </View>
              {fullStatistics ? (
                <Text style={[Typography.caption, { color: textSecondary }]}>
                  {t("overview.statisticsRange")}
                </Text>
              ) : null}
              <VolumeBarChart
                data={
                  (fullStatistics
                    ? detail?.volume_weeks
                    : detail?.volume_weeks.slice(-10)) ?? []
                }
                chartHeight={fullStatistics ? 200 : 120}
                scrollable={fullStatistics}
                today={todayProgress}
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
                getTooltip={(week) => {
                  const title = tString("overview.weekOf", {
                    date:
                      formatLongDate(week.week_start, locale) ??
                      week.week_start,
                  });
                  const weekMetrics = getExerciseWeekMetrics(
                    week.week_start,
                    sessions
                  );
                  const metrics = isTimeExercise
                    ? [
                        {
                          label: tString("overview.chartDuration"),
                          value: formatExerciseDuration(
                            week.total_duration_seconds ?? 0
                          ),
                        },
                        {
                          label: tString("overview.bestDuration"),
                          value: weekMetrics.maxDurationSeconds
                            ? formatExerciseDuration(
                                weekMetrics.maxDurationSeconds
                              )
                            : "-",
                        },
                      ]
                    : [
                        {
                          label: tString("overview.chartVolume"),
                          value: wu.formatVolume(week.volume_kg),
                        },
                        {
                          label: tString("overview.maxWeight"),
                          value: weekMetrics.maxWeightKg
                            ? wu.format(weekMetrics.maxWeightKg)
                            : "-",
                        },
                        {
                          label: tString("overview.maxReps"),
                          value: formatValue(weekMetrics.maxReps),
                        },
                        {
                          label: tString("overview.est1rm"),
                          value: weekMetrics.estimatedOneRepMaxKg
                            ? wu.format(weekMetrics.estimatedOneRepMaxKg)
                            : "-",
                        },
                      ];

                  return {
                    title,
                    metrics,
                    accessibilityLabel: [
                      title,
                      ...metrics.map(
                        (metric) => `${metric.label}: ${metric.value}`
                      ),
                    ].join(", "),
                  };
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

    if (detailLoading || editableHistoryLoading) {
      return <LoadingPlaceholder />;
    }

    if (detailError || editableHistoryError) {
      return (
        <ErrorState
          title={t("error.title")}
          message={t("error.detail")}
          retryLabel={t("error.retry")}
          onRetry={() => {
            refetchDetail();
            refetchEditableHistory();
          }}
        />
      );
    }

    const isTimeExercise =
      (detail?.exercise_type ?? exercise?.exercise_type) === "time";

    if (!editableHistory || editableHistory.length === 0) {
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
        {editableHistory.map((session) => (
          <SessionRow
            key={session.id}
            session={session}
            setLabel={(number) => t("history.set", { number })}
            completedSetsLabel={t("history.completedSets", {
              count: session.sets?.length ?? 0,
            })}
            isTimeExercise={isTimeExercise}
            wu={wu}
            menuAccessibilityLabel={tHistory("detail.exerciseMenu.open", {
              exerciseName: exercise?.name ?? session.workout_name,
            })}
            onOpenMenu={() => {
              setSelectedHistory(session);
              setHistoryMenuVisible(true);
            }}
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
          {fullStatistics ? (
            <ScrollView
              contentContainerStyle={styles.scroll}
              showsVerticalScrollIndicator={false}
            >
              <Text style={[Typography.titleMd, { color: textColor }]}>
                {t("overview.statisticsTitle")}
              </Text>
              {renderOverview()}
            </ScrollView>
          ) : (
            <GestureDetector gesture={swipeGesture}>
              <ScrollView
                contentContainerStyle={styles.scroll}
                showsVerticalScrollIndicator={false}
              >
                {activeTab == null ? (
                  <LoadingPlaceholder />
                ) : (
                  <>
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
                        activeTabHeight > 0
                          ? { minHeight: activeTabHeight }
                          : null,
                        activeTabHeight > 0 ? pagerViewportStyle : null,
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
                              width: pagerWidth || "100%",
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
                              width: pagerWidth || "100%",
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
                              width: pagerWidth || "100%",
                              minHeight: activeTabHeight || undefined,
                            },
                          ]}
                        >
                          <View
                            onLayout={(event) =>
                              handleTabPanelLayout("howTo", event)
                            }
                          >
                            {renderHowTo()}
                          </View>
                        </View>
                      </Animated.View>
                    </Animated.View>
                  </>
                )}
              </ScrollView>
            </GestureDetector>
          )}
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
          <ExerciseHistoryMenu
            visible={historyMenuVisible}
            exerciseName={exercise?.name ?? ""}
            dateLabel={
              selectedHistory
                ? (formatLongDate(selectedHistory.date, locale) ??
                  selectedHistory.date)
                : ""
            }
            setCount={selectedHistory?.sets.length ?? 0}
            onClose={() => setHistoryMenuVisible(false)}
            onEdit={() => setHistoryEditorVisible(true)}
            onDelete={handleDeleteHistory}
          />
          <ExerciseHistoryEditSheet
            visible={historyEditorVisible}
            exerciseName={exercise?.name ?? ""}
            workoutName={selectedHistory?.workout_name ?? ""}
            workoutDate={
              selectedHistory
                ? (formatLongDate(selectedHistory.date, locale) ??
                  selectedHistory.date)
                : ""
            }
            exerciseType={
              detail?.exercise_type ?? exercise?.exercise_type ?? "weight"
            }
            sets={selectedHistory?.sets ?? []}
            onClose={() => setHistoryEditorVisible(false)}
            onSave={handleSaveHistory}
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
  chartHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  chartTitle: { flex: 1 },
  statisticsLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    minHeight: 44,
    maxWidth: "50%",
    flexShrink: 1,
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
    gap: 2,
  },
  sessionPrimaryRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.md,
  },
  sessionTitle: {
    flex: 1,
    minWidth: 0,
  },
  sessionDate: {
    flexShrink: 0,
    textAlign: "right",
  },
  sessionMenuButton: {
    alignItems: "center",
    height: 24,
    justifyContent: "center",
    marginRight: -Spacing.sm,
    width: 32,
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
