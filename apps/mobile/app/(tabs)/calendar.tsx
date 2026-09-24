import type { WorkoutSession } from "@/components/calendar/types";
import { MonthBlock, getMonthHeight } from "@/components/calendar/month-block";
import { TabScreen } from "@/components/ui/tab-screen";
import { Spacing } from "@/constants/theme";
import { useCalendarToday } from "@/hooks/use-calendar-today";
import { useCalendarEntries } from "@/hooks/use-calendar-entries";
import { useTabBarClearance } from "@/hooks/use-tab-bar-clearance";
import { useThemeColor } from "@/hooks/use-theme-color";
import {
  getCalendarWeekStartKey,
  MOCK_NEXT_WEEK_AS_RUINED,
} from "@/lib/streak-calendar";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface MonthItem {
  year: number;
  month: number;
}

function generateMonths(count: number, now: Date): MonthItem[] {
  const previewEnd = new Date(`${getCalendarWeekStartKey(now)}T00:00:00`);
  previewEnd.setDate(previewEnd.getDate() + 13);
  const includeNextMonth =
    MOCK_NEXT_WEEK_AS_RUINED &&
    (previewEnd.getMonth() !== now.getMonth() ||
      previewEnd.getFullYear() !== now.getFullYear());
  const result: MonthItem[] = [];
  for (let i = includeNextMonth ? -1 : 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }
  return result;
}

const MIN_REFRESH_INDICATOR_MS = 500;

export default function CalendarScreen() {
  const today = useCalendarToday();
  const months = useMemo(
    () => generateMonths(24, new Date(`${today}T00:00:00`)),
    [today]
  );
  const itemOffsets = useMemo(() => {
    let offset = 0;
    return months.map(({ year, month }) => {
      const start = offset;
      offset += getMonthHeight(year, month);
      return start;
    });
  }, [months]);
  const { t } = useTranslation("calendar");
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const router = useRouter();
  const primary = useThemeColor({}, "primary");
  const backgroundElevated = useThemeColor({}, "backgroundElevated");
  const refreshInFlightRef = useRef(false);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const {
    getEntriesForMonth,
    getWeekStatusForDate,
    isLoading,
    isRefetching,
    refetch,
  } = useCalendarEntries(today);

  const handleDayPress = useCallback(
    (dateKey: string, sessions: WorkoutSession[]) => {
      if (sessions.length === 1) {
        router.push({
          pathname: "/workout-detail",
          params: { id: sessions[0].id },
        });
        return;
      }
      router.push({ pathname: "/history", params: { date: dateKey } });
    },
    [router]
  );

  const handleRefresh = useCallback(async () => {
    if (isRefetching || refreshInFlightRef.current) return;

    refreshInFlightRef.current = true;
    setIsManualRefreshing(true);
    const refreshStartedAt = Date.now();
    try {
      await refetch();
    } finally {
      const remainingIndicatorTime =
        MIN_REFRESH_INDICATOR_MS - (Date.now() - refreshStartedAt);
      if (remainingIndicatorTime > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, remainingIndicatorTime)
        );
      }
      refreshInFlightRef.current = false;
      setIsManualRefreshing(false);
    }
  }, [isRefetching, refetch]);

  const isRefreshing = isManualRefreshing || (isRefetching && !isLoading);

  return (
    <TabScreen>
      <FlatList
        style={styles.list}
        data={months}
        key={today.slice(0, 7)}
        keyExtractor={(item) => `${item.year}-${item.month}`}
        initialScrollIndex={0}
        getItemLayout={(_, index) => ({
          length: getMonthHeight(months[index].year, months[index].month),
          offset: itemOffsets[index],
          index,
        })}
        contentContainerStyle={{
          paddingTop: insets.top + Spacing.lg,
          paddingBottom: tabBarClearance,
          paddingLeft: insets.left + Spacing.xl,
          paddingRight: insets.right + Spacing.xl,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={primary}
            colors={[primary]}
            progressBackgroundColor={backgroundElevated}
            progressViewOffset={insets.top + Spacing.lg}
          />
        }
        renderItem={({ item }) => (
          <MonthBlock
            year={item.year}
            month={item.month}
            todayDateKey={today}
            entries={isLoading ? [] : getEntriesForMonth(item.year, item.month)}
            getWeekStatusForDate={getWeekStatusForDate}
            onDayPress={handleDayPress}
          />
        )}
      />
      {isRefreshing ? (
        <View
          pointerEvents="none"
          accessibilityRole="progressbar"
          accessibilityLabel={t("refreshing")}
          style={[
            styles.refreshIndicator,
            {
              top: insets.top + Spacing.sm,
              backgroundColor: backgroundElevated,
            },
          ]}
        >
          <ActivityIndicator color={primary} />
        </View>
      ) : null}
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  refreshIndicator: {
    position: "absolute",
    alignSelf: "center",
    zIndex: 10,
    padding: Spacing.sm,
    borderRadius: Spacing.lg,
  },
});
