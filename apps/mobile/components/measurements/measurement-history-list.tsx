import { useMemo, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import type { MeasurementHistoryItem as HistoryItemType } from "@/lib/api/body-measurements";
import type { MeasurementField, MeasurementUnit } from "@/data/measurements";
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
  const [expanded, setExpanded] = useState(true);
  const textColor = useThemeColor({}, "text");
  const textMuted = useThemeColor({}, "textMuted");
  const border = useThemeColor({}, "border");

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

  function renderItem({ item }: { item: GroupedData }) {
    return (
      <MeasurementHistoryDateGroup date={item.date}>
        {item.items.map((historyItem) => (
          <MeasurementHistoryItem
            key={historyItem.logged_at}
            item={historyItem}
            unit={unit}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </MeasurementHistoryDateGroup>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.container, { borderTopColor: border }]}>
        <TouchableOpacity
          onPress={() => setExpanded((prev) => !prev)}
          style={styles.header}
          disabled
        >
          <IconSymbol
            name="chevron.right"
            size={14}
            color={textMuted}
            style={expanded && styles.chevronOpen}
          />
          <Text style={[Typography.titleSm, { color: textColor }]}>
            {t("history.title")}
          </Text>
          <Text style={[Typography.caption, { color: textMuted }]}>
            {count}
          </Text>
        </TouchableOpacity>
        {expanded && (
          <View style={styles.loading}>
            <Text style={[Typography.body, { color: textMuted }]}>
              {t("history.loading")}
            </Text>
          </View>
        )}
      </View>
    );
  }

  if (!data || data.length === 0) {
    return (
      <View style={[styles.container, { borderTopColor: border }]}>
        <TouchableOpacity
          onPress={() => setExpanded((prev) => !prev)}
          style={styles.header}
        >
          <IconSymbol
            name="chevron.right"
            size={14}
            color={textMuted}
            style={expanded && styles.chevronOpen}
          />
          <Text style={[Typography.titleSm, { color: textColor }]}>
            {t("history.title")}
          </Text>
          <Text style={[Typography.caption, { color: textMuted }]}>
            {count}
          </Text>
        </TouchableOpacity>
        {expanded && (
          <View style={styles.empty}>
            <Text style={[Typography.body, { color: textMuted }]}>
              {t("history.empty")}
            </Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { borderTopColor: border }]}>
      <TouchableOpacity
        onPress={() => setExpanded((prev) => !prev)}
        accessibilityRole="button"
        accessibilityLabel={`${t("history.title")}, ${count} items`}
        style={styles.header}
      >
        <IconSymbol
          name="chevron.right"
          size={14}
          color={textMuted}
          style={expanded && styles.chevronOpen}
        />
        <Text style={[Typography.titleSm, { color: textColor }]}>
          {t("history.title")}
        </Text>
        <Text style={[Typography.caption, { color: textMuted }]}>{count}</Text>
      </TouchableOpacity>
      {expanded && (
        <FlatList
          data={groupedData}
          renderItem={renderItem}
          keyExtractor={(item) => item.date}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  chevronOpen: {
    transform: [{ rotate: "90deg" }],
  },
  loading: {
    paddingVertical: Spacing.lg,
    alignItems: "center",
  },
  empty: {
    paddingVertical: Spacing.xl,
    alignItems: "center",
  },
});
