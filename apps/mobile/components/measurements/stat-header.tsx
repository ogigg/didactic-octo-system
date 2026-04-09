import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { Spacing, Typography } from "@/constants/theme";
import type { MeasurementUnit } from "@/data/measurements";
import { useThemeColor } from "@/hooks/use-theme-color";
import type { MeasurementTrendPoint } from "@/lib/api/body-measurements";

interface StatHeaderProps {
  latestValue: number | null;
  unit: MeasurementUnit;
  trendData: MeasurementTrendPoint[] | undefined;
  label: string;
}

export function StatHeader({
  latestValue,
  unit,
  trendData,
  label,
}: StatHeaderProps) {
  const { t } = useTranslation("measurements");
  const textColor = useThemeColor({}, "text");
  const textMuted = useThemeColor({}, "textMuted");
  const primary = useThemeColor({}, "primary");

  const delta = computeDelta(trendData);

  return (
    <View style={styles.container}>
      <View style={styles.valueRow}>
        {latestValue !== null ? (
          <>
            <Text
              style={[Typography.displayLg, styles.value, { color: textColor }]}
            >
              {formatValue(latestValue)}
            </Text>
            <Text
              style={[Typography.titleMd, styles.unit, { color: textMuted }]}
            >
              {unit}
            </Text>
          </>
        ) : (
          <Text style={[Typography.titleMd, { color: textMuted }]}>
            {t("stat.noData")}
          </Text>
        )}
      </View>

      <View style={styles.metaRow}>
        <Text style={[Typography.caption, { color: textMuted }]}>{label}</Text>
        {delta !== null && (
          <View style={styles.deltaContainer}>
            <IconSymbol
              name={delta.direction === "up" ? "arrow.up" : "arrow.down"}
              size={10}
              color={primary}
            />
            <Text
              style={[
                Typography.caption,
                {
                  color: primary,
                  fontWeight: "600",
                },
              ]}
            >
              {formatValue(delta.amount)} {unit}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

interface Delta {
  amount: number;
  direction: "up" | "down";
}

function computeDelta(
  history: MeasurementTrendPoint[] | undefined
): Delta | null {
  if (!history || history.length < 2) return null;
  const sorted = [...history].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const oldest = sorted[0].value;
  const latest = sorted[sorted.length - 1].value;
  const diff = latest - oldest;
  if (diff === 0) return null;
  return {
    amount: Math.abs(diff),
    direction: diff > 0 ? "up" : "down",
  };
}

function formatValue(v: number): string {
  if (Number.isInteger(v)) return v.toString();
  return v.toFixed(1);
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xs,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: Spacing.sm,
  },
  value: {
    fontVariant: ["tabular-nums"],
  },
  unit: {
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  deltaContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
});
