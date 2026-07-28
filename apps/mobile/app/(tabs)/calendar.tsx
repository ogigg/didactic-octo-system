import type { WorkoutSession } from "@/components/calendar/types";
import { MonthBlock, getMonthHeight } from "@/components/calendar/month-block";
import { TabScreen } from "@/components/ui/tab-screen";
import { Spacing } from "@/constants/theme";
import { useCalendarEntries } from "@/hooks/use-calendar-entries";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { FlatList, RefreshControl, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface MonthItem {
  year: number;
  month: number;
}

function generateMonths(count: number): MonthItem[] {
  const now = new Date();
  const result: MonthItem[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }
  return result;
}

const MONTHS = generateMonths(24);

const ITEM_OFFSETS = MONTHS.reduce<number[]>((acc, item, i) => {
  if (i === 0) {
    acc.push(0);
  } else {
    const prev = MONTHS[i - 1];
    acc.push(acc[i - 1] + getMonthHeight(prev.year, prev.month));
  }
  return acc;
}, []);

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const primary = useThemeColor({}, "primary");
  const backgroundElevated = useThemeColor({}, "backgroundElevated");
  const refreshInFlightRef = useRef(false);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const { getEntriesForMonth, isLoading, isRefetching, refetch } =
    useCalendarEntries();

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
    try {
      await refetch();
    } finally {
      refreshInFlightRef.current = false;
      setIsManualRefreshing(false);
    }
  }, [isRefetching, refetch]);

  return (
    <TabScreen>
      <FlatList
        data={MONTHS}
        keyExtractor={(item) => `${item.year}-${item.month}`}
        initialScrollIndex={0}
        getItemLayout={(_, index) => ({
          length: getMonthHeight(MONTHS[index].year, MONTHS[index].month),
          offset: ITEM_OFFSETS[index],
          index,
        })}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing.lg,
            paddingBottom: insets.bottom + Spacing.lg,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isManualRefreshing || (isRefetching && !isLoading)}
            onRefresh={handleRefresh}
            tintColor={primary}
            colors={[primary]}
            progressBackgroundColor={backgroundElevated}
          />
        }
        renderItem={({ item }) => (
          <MonthBlock
            year={item.year}
            month={item.month}
            entries={isLoading ? [] : getEntriesForMonth(item.year, item.month)}
            onDayPress={handleDayPress}
          />
        )}
      />
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.xl,
  },
});
