import { useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import SectionCard from "@/components/ui/section-card";
import { ScreenHeader } from "@/components/ui/screen-header";
import { MeasurementLineChart } from "@/components/measurements/line-chart";
import { MeasurementGroup } from "@/components/measurements/measurement-group";
import { MeasurementRow } from "@/components/measurements/measurement-row";
import { MetricDropdown } from "@/components/measurements/metric-dropdown";
import { AddMeasurementModal } from "@/components/measurements/add-measurement-modal";
import { MeasurementHistoryList } from "@/components/measurements/measurement-history-list";
import { PeriodSelector } from "@/components/stats/period-selector";
import { NumericKeyboardAccessory } from "@/components/numeric-keyboard-accessory";
import { Button } from "@/components/ui/button";
import { Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import {
  useMeasurementTrend,
  useLatestMeasurements,
  useUpsertMeasurement,
  useMeasurementHistory,
  useDeleteMeasurement,
} from "@/hooks/use-measurement-queries";
import type { StatsPeriod } from "@/hooks/use-measurement-queries";
import type { MeasurementTrendPoint } from "@/lib/api/body-measurements";
import {
  MEASUREMENT_GROUPS,
  DEFAULT_FIELD,
  getMeasurementUnit,
} from "@/data/measurements";
import type { MeasurementField } from "@/data/measurements";

export default function MeasurementsScreen() {
  const { t } = useTranslation("measurements");
  const textMuted = useThemeColor({}, "textMuted");
  const backgroundElevated = useThemeColor({}, "backgroundElevated");

  const [selectedField, setSelectedField] =
    useState<MeasurementField>(DEFAULT_FIELD);
  const [period, setPeriod] = useState<StatsPeriod>("90d");
  const [modalVisible, setModalVisible] = useState(false);
  const [activeField, setActiveField] = useState<MeasurementField | null>(null);
  const [editingEntry, setEditingEntry] = useState<{
    date: string;
    value: number;
  } | null>(null);
  const [selectedPoint, setSelectedPoint] =
    useState<MeasurementTrendPoint | null>(null);

  const { data: trendData, isLoading: trendLoading } = useMeasurementTrend(
    selectedField,
    period
  );
  const { data: latestData } = useLatestMeasurements();
  const { data: historyData, isLoading: historyLoading } =
    useMeasurementHistory(selectedField);
  const upsertMutation = useUpsertMeasurement();
  const deleteMutation = useDeleteMeasurement();

  const unit = getMeasurementUnit(selectedField);

  function handleAddMeasurement(field: MeasurementField) {
    setActiveField(field);
    setEditingEntry(null);
    setModalVisible(true);
  }

  function handleAddPress() {
    setActiveField(selectedField);
    setEditingEntry(null);
    setModalVisible(true);
  }

  function handleEditEntry(entry: { date: string; value: number }) {
    setActiveField(selectedField);
    setEditingEntry({ date: entry.date, value: entry.value });
    setModalVisible(true);
  }

  function handleSave(date: string, value: number) {
    if (!activeField) return;
    upsertMutation.mutate({
      loggedAt: date,
      fields: { [activeField]: value },
    });
    setModalVisible(false);
    setEditingEntry(null);
  }

  function handleClose() {
    setModalVisible(false);
    setEditingEntry(null);
  }

  function handleDelete(loggedAt: string) {
    deleteMutation.mutate(loggedAt);
  }

  function handlePointPress(point: MeasurementTrendPoint) {
    setSelectedPoint(point);
  }

  function getLatestValue(field: MeasurementField): number | null {
    if (!latestData) return null;
    return latestData[field] ?? null;
  }

  function countFilledValues(fields: MeasurementField[]): number {
    if (!latestData) return 0;
    return fields.filter((f) => latestData[f] !== null).length;
  }

  const hasAnyData = latestData
    ? Object.values(latestData).some((v) => v !== null && v !== undefined)
    : false;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <ScreenHeader title={t("title")} />

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
              <MeasurementLineChart
                data={trendData}
                unit={unit}
                selectedPoint={selectedPoint}
                onPointPress={handlePointPress}
              />
            ) : (
              <View style={styles.emptyChart}>
                <Text style={[Typography.body, { color: textMuted }]}>
                  {t("chart.empty")}
                </Text>
              </View>
            )}
            {trendData && trendData.length > 1 && (
              <Text
                style={[
                  Typography.caption,
                  { color: textMuted, textAlign: "center" },
                ]}
              >
                {t("chart.tapToSeeDetails")}
              </Text>
            )}
          </SectionCard>

          {hasAnyData && (
            <SectionCard>
              <MeasurementHistoryList
                data={historyData}
                isLoading={historyLoading}
                unit={unit}
                onEdit={handleEditEntry}
                onDelete={handleDelete}
              />
            </SectionCard>
          )}

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

          <View style={styles.spacer} />
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: backgroundElevated }]}>
          <Button
            label={t("addButton")}
            onPress={handleAddPress}
            style={styles.addButton}
          />
        </View>

        <AddMeasurementModal
          visible={modalVisible}
          field={activeField}
          initialValue={
            editingEntry?.value ??
            (activeField ? getLatestValue(activeField) : null)
          }
          initialDate={editingEntry?.date}
          isEditing={editingEntry !== null}
          onSave={handleSave}
          onClose={handleClose}
        />

        <NumericKeyboardAccessory />
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
  spacer: {
    height: 80,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Platform.select({ ios: Spacing.xl, android: Spacing.lg }),
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  addButton: {
    width: "100%",
  },
});
