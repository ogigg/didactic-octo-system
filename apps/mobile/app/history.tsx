import { WorkoutHistoryCard } from "@/components/history/workout-history-card";
import { BackButton } from "@/components/ui/back-button";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useWorkoutHistory } from "@/hooks/use-workout-queries";
import { Spacing, Typography } from "@/constants/theme";
import type { WorkoutHistoryItem } from "@/lib/api/workouts";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function HistoryScreen() {
  const { t } = useTranslation("history");
  const router = useRouter();

  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const primary = useThemeColor({}, "primary");
  const background = useThemeColor({}, "background");
  const border = useThemeColor({}, "border");

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isRefetching,
    refetch,
  } = useWorkoutHistory();

  const items: WorkoutHistoryItem[] = data?.pages.flat() ?? [];

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

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
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={primary} />
      </View>
    );
  }, [isFetchingNextPage, primary]);

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
          {t("empty.title")}
        </Text>
        <Text
          style={[
            Typography.body,
            { color: textSecondary },
            styles.emptySubtitle,
          ]}
        >
          {t("empty.subtitle")}
        </Text>
      </View>
    );
  }, [isLoading, primary, textColor, textSecondary, t]);

  return (
    <View style={[styles.root, { backgroundColor: background }]}>
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: border }]}>
          <BackButton accessibilityLabel={t("header.back")} />
          <Text style={[Typography.titleLg, { color: textColor }]}>
            {t("title")}
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
              onRefresh={refetch}
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
