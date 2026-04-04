import { WorkoutHistoryCard } from "@/components/history/workout-history-card";
import { BackButton } from "@/components/ui/back-button";
import { useThemeColor } from "@/hooks/use-theme-color";
import {
  useWorkoutHistory,
  useWorkoutHistoryForDay,
} from "@/hooks/use-workout-queries";
import { Spacing, Typography } from "@/constants/theme";
import type { WorkoutHistoryItem } from "@/lib/api/workouts";
import { isValidDateKey } from "@/lib/local-day-bounds";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function formatDayHeaderTitle(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(y, m - 1, d));
}

export default function HistoryScreen() {
  const { t } = useTranslation("history");
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string | string[] }>();

  const dayFilter = useMemo(() => {
    const raw = params.date;
    const dateParam =
      typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
    if (dateParam && isValidDateKey(dateParam)) return dateParam;
    return undefined;
  }, [params.date]);

  const isDayMode = !!dayFilter;

  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const primary = useThemeColor({}, "primary");
  const background = useThemeColor({}, "background");
  const border = useThemeColor({}, "border");

  const infinite = useWorkoutHistory({ enabled: !isDayMode });
  const dayQuery = useWorkoutHistoryForDay(dayFilter ?? "");

  const {
    data: infiniteData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: infiniteLoading,
    isRefetching: infiniteRefetching,
    refetch: infiniteRefetch,
  } = infinite;

  const items: WorkoutHistoryItem[] = isDayMode
    ? (dayQuery.data ?? [])
    : (infiniteData?.pages.flat() ?? []);

  const isLoading = isDayMode ? dayQuery.isLoading : infiniteLoading;
  const isRefetching = isDayMode ? dayQuery.isRefetching : infiniteRefetching;
  const refetch = isDayMode ? dayQuery.refetch : infiniteRefetch;

  const handleEndReached = useCallback(() => {
    if (isDayMode) return;
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [isDayMode, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(
    ({ item }: { item: WorkoutHistoryItem }) => (
      <WorkoutHistoryCard
        item={item}
        onPress={() =>
          router.push({ pathname: "/workout-detail", params: { id: item.id } })
        }
      />
    ),
    [router]
  );

  const renderFooter = useCallback(() => {
    if (isDayMode || !isFetchingNextPage) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={primary} />
      </View>
    );
  }, [isDayMode, isFetchingNextPage, primary]);

  const renderEmpty = useCallback(() => {
    if (isLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={primary} />
        </View>
      );
    }
    return (
      <View style={styles.centered}>
        <Text style={[Typography.titleMd, { color: textColor }]}>
          {isDayMode ? t("empty.dayTitle") : t("empty.title")}
        </Text>
        <Text
          style={[
            Typography.body,
            { color: textSecondary },
            styles.emptySubtitle,
          ]}
        >
          {isDayMode ? t("empty.daySubtitle") : t("empty.subtitle")}
        </Text>
      </View>
    );
  }, [isLoading, isDayMode, primary, textColor, textSecondary, t]);

  const headerTitle =
    isDayMode && dayFilter
      ? t("dayTitle", { date: formatDayHeaderTitle(dayFilter) })
      : t("title");

  return (
    <View style={[styles.root, { backgroundColor: background }]}>
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: border }]}>
          <BackButton accessibilityLabel={t("header.back")} />
          <Text
            style={[
              Typography.titleLg,
              styles.headerTitle,
              { color: textColor },
            ]}
            numberOfLines={isDayMode ? 2 : 1}
          >
            {headerTitle}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.4}
          contentContainerStyle={[
            styles.list,
            items.length === 0 && styles.listEmpty,
          ]}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching && !isLoading}
              onRefresh={() => {
                void refetch();
              }}
              tintColor={primary}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  headerSpacer: { width: 44 },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    marginHorizontal: Spacing.sm,
  },
  list: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing["3xl"],
  },
  listEmpty: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing["3xl"],
    gap: Spacing.sm,
  },
  emptySubtitle: {
    textAlign: "center",
  },
  footer: {
    paddingVertical: Spacing.xl,
    alignItems: "center",
  },
});
