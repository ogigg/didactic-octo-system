import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import SectionCard from "@/components/ui/section-card";
import { ScreenHeader } from "@/components/ui/screen-header";
import { MeasurementLineChart } from "@/components/measurements/line-chart";
import { MeasurementGroup } from "@/components/measurements/measurement-group";
import { MeasurementRow } from "@/components/measurements/measurement-row";
import { MetricDropdown } from "@/components/measurements/metric-dropdown";
import { LogSheet } from "@/components/measurements/log-sheet";
import { PeriodSelector } from "@/components/stats/period-selector";
import { Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import {
  useMeasurementTrend,
  useLatestMeasurements,
  useUpsertMeasurement,
} from "@/hooks/use-measurement-queries";
import type { StatsPeriod } from "@/hooks/use-measurement-queries";
import {
  MEASUREMENT_GROUPS,
  DEFAULT_FIELD,
  getMeasurementUnit,
} from "@/data/measurements";
import type { MeasurementField } from "@/data/measurements";

export default function MeasurementsScreen() {
  const { t } = useTranslation("measurements");
  const textMuted = useThemeColor({}, "textMuted");

  const [selectedField, setSelectedField] =
    useState<MeasurementField>(DEFAULT_FIELD);
  const [period, setPeriod] = useState<StatsPeriod>("90d");
  const [sheetVisible, setSheetVisible] = useState(false);
  const [activeField, setActiveField] = useState<MeasurementField | null>(null);

  const { data: trendData, isLoading: trendLoading } = useMeasurementTrend(
    selectedField,
    period
  );
  const { data: latestData } = useLatestMeasurements();
  const upsertMutation = useUpsertMeasurement();

  function handleAddMeasurement(field: MeasurementField) {
    setActiveField(field);
    setSheetVisible(true);
  }

  function handleSave(date: string, value: number) {
    if (!activeField) return;
    upsertMutation.mutate({
      loggedAt: date,
      fields: { [activeField]: value },
    });
    setSheetVisible(false);
  }

  function getLatestValue(field: MeasurementField): number | null {
    if (!latestData) return null;
    return latestData[field] ?? null;
  }

  function getActiveLatestValue(): number | null {
    if (!activeField) return null;
    return getLatestValue(activeField);
  }

  function countFilledValues(fields: MeasurementField[]): number {
    if (!latestData) return 0;
    return fields.filter((f) => latestData[f] !== null).length;
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <ScreenHeader title={t("title")} />

          {/* Chart Card */}
          <SectionCard accent>
            <View style={styles.chartControls}>
              <MetricDropdown
                selected={selectedField}
                onChange={setSelectedField}
              />
              <PeriodSelector
                selected={period}
                onChange={(p) => setPeriod(p as StatsPeriod)}
              />
            </View>
            {!trendLoading && trendData && trendData.length > 0 ? (
              <MeasurementLineChart data={trendData} />
            ) : (
              <View style={styles.emptyChart}>
                <Text style={[Typography.body, { color: textMuted }]}>
                  {t("chart.empty")}
                </Text>
              </View>
            )}
          </SectionCard>

          {/* Measurement Groups */}
          {MEASUREMENT_GROUPS.map((group) => (
            <MeasurementGroup
              key={group.key}
              title={t(`groups.${group.key}`)}
              count={countFilledValues(group.fields)}
              defaultOpen={group.key === "bodyComposition"}
            >
              {group.fields.map((field) => (
                <MeasurementRow
                  key={field}
                  field={field}
                  label={t(`fields.${field}`)}
                  latestValue={getLatestValue(field)}
                  unit={getMeasurementUnit(field)}
                  onAdd={() => handleAddMeasurement(field)}
                />
              ))}
            </MeasurementGroup>
          ))}
        </ScrollView>

        <LogSheet
          visible={sheetVisible}
          field={activeField}
          initialValue={getActiveLatestValue()}
          onSave={handleSave}
          onClose={() => setSheetVisible(false)}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  scroll: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing["3xl"],
    gap: Spacing.lg,
  },
  chartControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  emptyChart: {
    height: 180,
    alignItems: "center",
    justifyContent: "center",
  },
});
