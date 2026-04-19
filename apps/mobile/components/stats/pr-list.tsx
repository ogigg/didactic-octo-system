import { useState } from "react";
import { StyleSheet, View, Text, TextInput } from "react-native";

import { Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useWeightUnit } from "@/hooks/use-weight-unit";

interface PersonalRecord {
  exercise_id: string;
  exercise_name: string;
  max_weight_kg: number;
  max_reps: number;
  max_volume_set_kg: number;
  est_1rm_kg: number | null;
}

interface PRListProps {
  records: PersonalRecord[];
  emptyText?: string;
}

interface StatBlockProps {
  value: string;
  label: string;
  valueColor: string;
  labelColor: string;
}

function StatBlock({ value, label, valueColor, labelColor }: StatBlockProps) {
  return (
    <View style={styles.statBlock}>
      <Text style={[styles.statValue, { color: valueColor }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: labelColor }]}>{label}</Text>
    </View>
  );
}

export function PRList({ records, emptyText = "No records yet" }: PRListProps) {
  const [query, setQuery] = useState("");
  const { format: fmtWeight } = useWeightUnit();

  const borderSubtle = useThemeColor({}, "borderSubtle");
  const borderColor = useThemeColor({}, "border");
  const textColor = useThemeColor({}, "text");
  const textMuted = useThemeColor({}, "textMuted");
  const textSecondary = useThemeColor({}, "textSecondary");
  const primaryColor = useThemeColor({}, "primary");

  const filtered = query
    ? records.filter((r) =>
        r.exercise_name.toLowerCase().includes(query.toLowerCase())
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
        placeholder="Search exercises"
        placeholderTextColor={textMuted}
        accessibilityLabel="Search exercises"
        clearButtonMode="while-editing"
      />

      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: textSecondary }]}>
            {emptyText}
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
                  {record.exercise_name}
                </Text>
                <View style={styles.statsRow}>
                  <StatBlock
                    value={fmtWeight(record.max_weight_kg)}
                    label="Heaviest"
                    valueColor={textColor}
                    labelColor={textMuted}
                  />
                  <StatBlock
                    value={String(record.max_reps)}
                    label="Most Reps"
                    valueColor={textColor}
                    labelColor={textMuted}
                  />
                  <StatBlock
                    value={fmtWeight(record.max_volume_set_kg)}
                    label="Best Set"
                    valueColor={textColor}
                    labelColor={textMuted}
                  />
                  <StatBlock
                    value={
                      record.est_1rm_kg != null
                        ? fmtWeight(record.est_1rm_kg)
                        : "\u2014"
                    }
                    label="Est. 1RM"
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
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
  },
  emptyText: {
    ...Typography.body,
  },
});
