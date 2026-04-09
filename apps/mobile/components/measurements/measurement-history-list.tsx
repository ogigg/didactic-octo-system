import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import type { MeasurementHistoryItem as HistoryItemType } from "@/lib/api/body-measurements";
import type { MeasurementUnit } from "@/data/measurements";
import {
  MeasurementHistoryItem,
  MeasurementHistoryDateGroup,
} from "./measurement-history-item";

interface MeasurementHistoryListProps {
  data: HistoryItemType[] | undefined;
  isLoading: boolean;
  unit: MeasurementUnit;
  onEdit: (item: HistoryItemType) => void;
  onDelete: (loggedAt: string) => void;
}

interface GroupedData {
  date: string;
  items: HistoryItemType[];
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
      {groupedData.map((group) => (
        <MeasurementHistoryDateGroup key={group.date} date={group.date}>
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
      ))}
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
