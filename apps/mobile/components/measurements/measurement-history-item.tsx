import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import type { MeasurementHistoryItem as HistoryItemType } from "@/lib/api/body-measurements";
import type { MeasurementUnit } from "@/data/measurements";

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
  const textSecondary = useThemeColor({}, "textSecondary");
  const border = useThemeColor({}, "border");
  const error = useThemeColor({}, "error");

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
    <View style={[styles.row, { borderBottomColor: border }]}>
      <View style={styles.left}>
        <Text style={[Typography.bodyMedium, { color: textColor }]}>
          {item.value}
          <Text style={[Typography.caption, { color: textMuted }]}>
            {" "}
            {unit}
          </Text>
        </Text>
      </View>
      <Text style={[Typography.caption, { color: textSecondary }]}>
        {formatShortDate(item.date)}
      </Text>
      <Pressable
        onPress={() => onEdit(item)}
        accessibilityRole="button"
        accessibilityLabel={t("history.edit")}
        hitSlop={8}
        style={styles.iconButton}
      >
        <IconSymbol name="pencil" size={14} color={textMuted} />
      </Pressable>
      <Pressable
        onPress={handleDelete}
        accessibilityRole="button"
        accessibilityLabel={t("history.delete")}
        hitSlop={8}
        style={styles.iconButton}
      >
        <IconSymbol name="trash" size={14} color={error} />
      </Pressable>
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

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatGroupDate(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  left: {
    flex: 1,
  },
  iconButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  dateGroup: {
    marginTop: Spacing.md,
  },
  dateGroupLabel: {
    marginBottom: Spacing.xs,
    textTransform: "uppercase",
  },
});
