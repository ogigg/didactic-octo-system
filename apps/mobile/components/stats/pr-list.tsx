import { useState } from "react";
import { StyleSheet, View, Text, TextInput } from "react-native";

import { Elevation, Radii, Spacing, Typography } from "@/constants/theme";
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

function formatNum(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

interface StatBlockProps {
  value: string;
  label: string;
  primaryColor: string;
  textMuted: string;
}

function StatBlock({ value, label, primaryColor, textMuted }: StatBlockProps) {
  return (
    <View style={styles.statBlock}>
      <Text style={[styles.statValue, { color: primaryColor }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: textMuted }]}>{label}</Text>
    </View>
  );
}

export function PRList({ records, emptyText = "No records yet" }: PRListProps) {
  const [query, setQuery] = useState("");
  const { format: fmtWeight } = useWeightUnit();

  const backgroundSubtle = useThemeColor({}, "backgroundSubtle");
  const inputFill = useThemeColor({}, "inputFill");
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
            backgroundColor: inputFill,
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
        <View style={styles.list}>
          {filtered.map((record) => (
            <View
              key={record.exercise_id}
              style={[
                styles.card,
                { backgroundColor: backgroundSubtle },
                Elevation.sm,
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
                  primaryColor={primaryColor}
                  textMuted={textMuted}
                />
                <StatBlock
                  value={String(record.max_reps)}
                  label="Most Reps"
                  primaryColor={primaryColor}
                  textMuted={textMuted}
                />
                <StatBlock
                  value={fmtWeight(record.max_volume_set_kg)}
                  label="Best Set"
                  primaryColor={primaryColor}
                  textMuted={textMuted}
                />
                <StatBlock
                  value={
                    record.est_1rm_kg != null
                      ? fmtWeight(record.est_1rm_kg)
                      : "\u2014"
                  }
                  label="Est. 1RM"
                  primaryColor={primaryColor}
                  textMuted={textMuted}
                />
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchInput: {
    ...Typography.body,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.md,
  },
  list: {
    gap: Spacing.sm,
  },
  card: {
    borderRadius: Radii.lg,
    padding: Spacing.lg,
  },
  exerciseName: {
    ...Typography.titleSm,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.md,
  },
  statBlock: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    ...Typography.titleMd,
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
