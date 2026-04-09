import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { Spacing, Typography } from "@/constants/theme";
import type { MeasurementUnit } from "@/data/measurements";
import { useThemeColor } from "@/hooks/use-theme-color";
import type { MeasurementHistoryItem as HistoryItemType } from "@/lib/api/body-measurements";
import {
  MeasurementHistoryDateGroup,
  MeasurementHistoryItem,
  YearSeparator,
} from "./measurement-history-item";

interface MeasurementHistoryListProps {
  data: HistoryItemType[] | undefined;
  isLoading: boolean;
  unit: MeasurementUnit;
  onEdit: (item: HistoryItemType) => void;
  onDelete: (loggedAt: string) => void;
}

export function MeasurementHistoryList({
  data,
  isLoading,
  unit,
  onEdit,
  onDelete,
}: MeasurementHistoryListProps) {
  const { t } = useTranslation("measurements");
  const textColor = useThemeColor({}, "text");
  const textMuted = useThemeColor({}, "textMuted");

  const groupedData = useMemo(() => {
    if (!data) return [];
    const groups: Map<string, HistoryItemType[]> = new Map();
    for (const item of data) {
      const dateKey = item.date;
      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
      groups.get(dateKey)!.push(item);
    }
    return Array.from(groups.entries()).map(([date, items]) => ({
      date,
      items,
    }));
  }, [data]);

  const dataWithYears = useMemo(() => {
    return groupedData.map((group) => ({
      ...group,
      year: new Date(group.date).getFullYear(),
    }));
  }, [groupedData]);

  const count = data?.length ?? 0;

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={[Typography.titleSm, { color: textColor }]}>
            {t("history.title")}
          </Text>
        </View>
        <Text style={[Typography.caption, styles.empty, { color: textMuted }]}>
          {t("history.loading")}
        </Text>
      </View>
    );
  }

  if (!data || data.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={[Typography.titleSm, { color: textColor }]}>
            {t("history.title")}
          </Text>
        </View>
        <Text style={[Typography.caption, styles.empty, { color: textMuted }]}>
          {t("history.empty")}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[Typography.titleSm, { color: textColor }]}>
          {t("history.title")}
        </Text>
        <Text style={[Typography.caption, { color: textMuted }]}>{count}</Text>
      </View>
      {dataWithYears.map((group, index) => {
        const prevYear = index > 0 ? dataWithYears[index - 1].year : null;
        const showYearSeparator = prevYear !== null && prevYear !== group.year;
        const isLast =
          index === dataWithYears.length - 1 ||
          dataWithYears[index + 1]?.year !== group.year;
        return (
          <View key={group.date}>
            {showYearSeparator && <YearSeparator year={group.year} />}
            <MeasurementHistoryDateGroup date={group.date} isLast={isLast}>
              {group.items.map((item) => (
                <MeasurementHistoryItem
                  key={item.logged_at}
                  item={item}
                  unit={unit}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </MeasurementHistoryDateGroup>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xs,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  empty: {
    paddingVertical: Spacing.lg,
    textAlign: "center",
  },
});
