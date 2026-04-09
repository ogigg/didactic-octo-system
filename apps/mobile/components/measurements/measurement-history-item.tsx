import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import type { MeasurementHistoryItem as HistoryItemType } from "@/lib/api/body-measurements";
import type { MeasurementUnit } from "@/data/measurements";
import { useTranslation } from "react-i18next";

interface MeasurementHistoryItemProps {
  item: HistoryItemType;
  unit: MeasurementUnit;
  onEdit: (item: HistoryItemType) => void;
  onDelete: (loggedAt: string) => void;
}

export function MeasurementHistoryItem({
  item,
  unit,
  onEdit,
  onDelete,
}: MeasurementHistoryItemProps) {
  const { t } = useTranslation("measurements");
  const textColor = useThemeColor({}, "text");
  const textMuted = useThemeColor({}, "textMuted");
  const backgroundSubtle = useThemeColor({}, "backgroundSubtle");
  const primary = useThemeColor({}, "primary");

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function handleDelete() {
    Alert.alert(
      t("history.deleteConfirmTitle"),
      t("history.deleteConfirmMessage", { value: item.value, unit }),
      [
        { text: t("history.cancel"), style: "cancel" },
        {
          text: t("history.delete"),
          style: "destructive",
          onPress: () => onDelete(item.logged_at),
        },
      ]
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: backgroundSubtle }]}>
      <View style={styles.valueContainer}>
        <Text style={[Typography.titleMd, { color: textColor }]}>
          {item.value}
        </Text>
        <Text style={[Typography.body, { color: textMuted }]}>{unit}</Text>
      </View>
      <Text style={[Typography.caption, { color: textMuted }]}>
        {formatDate(item.date)}
      </Text>
      <View style={styles.actions}>
        <Pressable
          onPress={() => onEdit(item)}
          accessibilityRole="button"
          accessibilityLabel={t("history.edit")}
          style={[styles.actionButton]}
        >
          <IconSymbol name="pencil" size={18} color={primary} />
        </Pressable>
        <Pressable
          onPress={handleDelete}
          accessibilityRole="button"
          accessibilityLabel={t("history.delete")}
          style={[styles.actionButton]}
        >
          <IconSymbol name="trash" size={18} color={textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

interface MeasurementHistoryDateGroupProps {
  date: string;
  children: React.ReactNode;
}

export function MeasurementHistoryDateGroup({
  date,
  children,
}: MeasurementHistoryDateGroupProps) {
  const textMuted = useThemeColor({}, "textMuted");

  function formatGroupDate(dateStr: string): string {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) {
      return "Today";
    }
    if (d.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    }
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <View style={styles.dateGroup}>
      <Text
        style={[Typography.label, styles.dateGroupLabel, { color: textMuted }]}
      >
        {formatGroupDate(date)}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radii.md,
    marginBottom: Spacing.sm,
  },
  valueContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    flex: 1,
    gap: Spacing.xs,
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: Radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
  dateGroup: {
    marginBottom: Spacing.md,
  },
  dateGroupLabel: {
    marginBottom: Spacing.sm,
    textTransform: "uppercase",
  },
});
