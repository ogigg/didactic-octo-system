import { useTranslation } from "react-i18next";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { Spacing, Typography } from "@/constants/theme";
import type { MeasurementUnit } from "@/data/measurements";
import { useThemeColor } from "@/hooks/use-theme-color";
import type { MeasurementHistoryItem as HistoryItemType } from "@/lib/api/body-measurements";

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
    <View style={[styles.row]}>
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

export function MeasurementHistoryDateGroup({
  date,
  children,
  isLast,
}: {
  date: string;
  children: React.ReactNode;
  isLast?: boolean;
}) {
  const textMuted = useThemeColor({}, "textMuted");
  const border = useThemeColor({}, "border");

  return (
    <View
      style={[
        styles.dateGroup,
        {
          borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: border,
        },
      ]}
    >
      <Text
        style={[Typography.label, styles.dateGroupLabel, { color: textMuted }]}
      >
        {formatGroupDate(date)}
      </Text>
      {children}
    </View>
  );
}

export function YearSeparator({ year }: { year: number }) {
  const border = useThemeColor({}, "border");
  const textMuted = useThemeColor({}, "textMuted");

  return (
    <View style={[styles.yearSeparator, { borderBottomColor: border }]}>
      <View style={[styles.yearSeparatorLine, { backgroundColor: border }]} />
      <Text
        style={[
          Typography.label,
          styles.yearSeparatorText,
          { color: textMuted },
        ]}
      >
        {year}
      </Text>
      <View style={[styles.yearSeparatorLine, { backgroundColor: border }]} />
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
  yearSeparator: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
  },
  yearSeparatorLine: {
    flex: 1,
    height: 1,
  },
  yearSeparatorText: {
    textTransform: "uppercase",
  },
});
