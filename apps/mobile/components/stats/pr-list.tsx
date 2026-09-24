import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View, Text, TextInput } from "react-native";

import { Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useWeightUnit } from "@/hooks/use-weight-unit";
import { useLocalizedExerciseMap } from "@/hooks/use-exercises-query";
import type { PersonalRecord } from "@/lib/api/stats";

interface PRListProps {
  records: PersonalRecord[];
  emptyText?: string;
}

interface StatBlockProps {
  value: string;
  label: string;
  secondaryText?: string;
  valueColor: string;
  labelColor: string;
}

function StatBlock({
  value,
  label,
  secondaryText,
  valueColor,
  labelColor,
}: StatBlockProps) {
  return (
    <View style={styles.statBlock}>
      <Text style={[styles.statValue, { color: valueColor }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: labelColor }]}>{label}</Text>
      {secondaryText ? (
        <Text style={[styles.statContext, { color: labelColor }]}>
          {secondaryText}
        </Text>
      ) : null}
    </View>
  );
}

export function PRList({ records, emptyText }: PRListProps) {
  const { t } = useTranslation("stats");
  const [query, setQuery] = useState("");
  const { format: fmtWeight } = useWeightUnit();
  const { exerciseMap } = useLocalizedExerciseMap(
    records.map((record) => record.exercise_id)
  );

  const borderSubtle = useThemeColor({}, "borderSubtle");
  const borderColor = useThemeColor({}, "border");
  const textColor = useThemeColor({}, "text");
  const textMuted = useThemeColor({}, "textMuted");
  const textSecondary = useThemeColor({}, "textSecondary");
  const primaryColor = useThemeColor({}, "primary");

  const filtered = query
    ? records.filter((r) =>
        (exerciseMap.get(r.exercise_id)?.name ?? r.exercise_name)
          .toLowerCase()
          .includes(query.toLowerCase())
      )
    : records;

  return (
    <View>
      <TextInput
        style={[
          styles.searchInput,
          {
            backgroundColor: borderSubtle,
            color: textColor,
          },
        ]}
        value={query}
        onChangeText={setQuery}
        placeholder={t("records.searchPlaceholder")}
        placeholderTextColor={textMuted}
        accessibilityLabel={t("records.searchPlaceholder")}
        clearButtonMode="while-editing"
      />

      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: textSecondary }]}>
            {emptyText ?? t("records.empty")}
          </Text>
        </View>
      ) : (
        <View>
          {filtered.map((record, index) => {
            const isLast = index === filtered.length - 1;
            return (
              <View
                key={record.exercise_id}
                style={[
                  styles.row,
                  !isLast && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: borderColor,
                  },
                ]}
              >
                <Text
                  style={[styles.exerciseName, { color: textColor }]}
                  numberOfLines={1}
                >
                  {exerciseMap.get(record.exercise_id)?.name ??
                    record.exercise_name}
                </Text>
                <View style={styles.statsRow}>
                  <StatBlock
                    value={fmtWeight(record.max_weight_kg)}
                    label={t("records.heaviest")}
                    secondaryText={
                      record.max_weight_reps != null
                        ? t("records.heaviestReps", {
                            reps: record.max_weight_reps,
                          })
                        : undefined
                    }
                    valueColor={textColor}
                    labelColor={textMuted}
                  />
                  <StatBlock
                    value={String(record.max_reps)}
                    label={t("records.mostReps")}
                    secondaryText={
                      record.max_reps_weight_kg != null
                        ? t("records.mostRepsWeight", {
                            weight: fmtWeight(record.max_reps_weight_kg),
                          })
                        : undefined
                    }
                    valueColor={textColor}
                    labelColor={textMuted}
                  />
                  <StatBlock
                    value={fmtWeight(record.max_volume_set_kg)}
                    label={t("records.bestSet")}
                    valueColor={textColor}
                    labelColor={textMuted}
                  />
                  <StatBlock
                    value={
                      record.est_1rm_kg != null
                        ? fmtWeight(record.est_1rm_kg)
                        : "\u2014"
                    }
                    label={t("records.est1rm")}
                    valueColor={primaryColor}
                    labelColor={textMuted}
                  />
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchInput: {
    ...Typography.body,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.sm,
  },
  row: {
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  exerciseName: {
    ...Typography.titleSm,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statBlock: {
    flex: 1,
    alignItems: "flex-start",
  },
  statValue: {
    ...Typography.bodyMedium,
    fontVariant: ["tabular-nums"],
  },
  statLabel: {
    ...Typography.micro,
    marginTop: 2,
  },
  statContext: {
    ...Typography.micro,
    marginTop: 1,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
  },
  emptyText: {
    ...Typography.body,
  },
});
