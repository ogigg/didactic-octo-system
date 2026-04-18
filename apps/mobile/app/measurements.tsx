import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";

import { AmbientGlow } from "@/components/ambient-glow";
import { EditMeasurementModal } from "@/components/measurements/edit-measurement-modal";
import { FieldPillSelector } from "@/components/measurements/field-pill-selector";
import { MeasurementLineChart } from "@/components/measurements/line-chart";
import { LogMeasurementsModal } from "@/components/measurements/log-measurements-modal";
import { MeasurementHistoryList } from "@/components/measurements/measurement-history-list";
import { StatHeader } from "@/components/measurements/stat-header";
import { NumericKeyboardAccessory } from "@/components/numeric-keyboard-accessory";
import { PeriodSelector } from "@/components/stats/period-selector";
import { GradientSurface } from "@/components/ui/gradient-surface";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Radii, Spacing, Typography } from "@/constants/theme";
import type { MeasurementField } from "@/data/measurements";
import { getMeasurementUnit } from "@/data/measurements";
import type { StatsPeriod } from "@/hooks/use-measurement-queries";
import {
  useDeleteMeasurement,
  useLatestMeasurements,
  useMeasurementHistory,
  useMeasurementTrend,
  useUpsertMeasurement,
} from "@/hooks/use-measurement-queries";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useWeightUnit } from "@/hooks/use-weight-unit";
import type { MeasurementTrendPoint } from "@/lib/api/body-measurements";

const DEFAULT_FIELD: MeasurementField = "weight_kg";

export default function MeasurementsScreen() {
  const { t } = useTranslation("measurements");
  const { unit: weightUnit } = useWeightUnit();
  const textMuted = useThemeColor({}, "textMuted");
  const heroStart = useThemeColor({}, "heroGradientStart");
  const heroEnd = useThemeColor({}, "heroGradientEnd");

  const [selectedField, setSelectedField] =
    useState<MeasurementField>(DEFAULT_FIELD);
  const [period, setPeriod] = useState<StatsPeriod>("90d");
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModal, setEditModal] = useState<{
    visible: boolean;
    date: string;
    originalDate: string;
    value: number;
  }>({ visible: false, date: "", originalDate: "", value: 0 });
  const [selectedPoint, setSelectedPoint] =
    useState<MeasurementTrendPoint | null>(null);

  const {
    data: trendData,
    isLoading: trendLoading,
    refetch: refetchTrend,
  } = useMeasurementTrend(selectedField, period);
  const { data: latestData, refetch: refetchLatest } = useLatestMeasurements();
  const {
    data: historyData,
    isLoading: historyLoading,
    refetch: refetchHistory,
  } = useMeasurementHistory(selectedField);
  const upsertMutation = useUpsertMeasurement();
  const deleteMutation = useDeleteMeasurement();
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsManualRefreshing(true);
    await Promise.all([refetchTrend(), refetchLatest(), refetchHistory()]);
    setIsManualRefreshing(false);
  }, [refetchTrend, refetchLatest, refetchHistory]);

  const unit = getMeasurementUnit(selectedField, weightUnit);
  const latestValue = latestData?.[selectedField] ?? null;
  const fieldLabel = t(`fields.${selectedField}`);

  function handleAddPress() {
    setAddModalVisible(true);
  }

  function handleMultiSave(date: string, fields: Record<string, number>) {
    upsertMutation.mutate({ loggedAt: date, fields });
    setAddModalVisible(false);
  }

  function handleEditEntry(entry: { date: string; value: number }) {
    setEditModal({
      visible: true,
      date: entry.date,
      originalDate: entry.date,
      value: entry.value,
    });
  }

  function handleEditSave(date: string, value: number) {
    upsertMutation.mutate({
      loggedAt: date,
      originalLoggedAt: editModal.originalDate,
      fields: { [selectedField]: value },
    });
    setEditModal({ visible: false, date: "", originalDate: "", value: 0 });
  }

  function handleDelete(loggedAt: string) {
    deleteMutation.mutate(loggedAt);
  }

  function handlePointPress(point: MeasurementTrendPoint) {
    setSelectedPoint(point);
  }

  return (
    <View style={styles.root}>
      <AmbientGlow variant="subtle" />
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isManualRefreshing}
              onRefresh={handleRefresh}
            />
          }
        >
          <ScreenHeader title={t("title")} />

          <FieldPillSelector
            selected={selectedField}
            onChange={(f) => {
              setSelectedField(f);
              setSelectedPoint(null);
            }}
          />

          {/* Hero: current value + trend + chart */}
          <GradientSurface
            variant="accent"
            radius="lg"
            bordered
            style={styles.hero}
          >
            <StatHeader
              latestValue={latestValue}
              unit={unit}
              trendData={trendData}
              label={fieldLabel}
            />

            <PeriodSelector
              selected={period}
              onChange={(p) => setPeriod(p as StatsPeriod)}
            />

            {!trendLoading && trendData && trendData.length > 0 ? (
              <MeasurementLineChart
                data={trendData}
                unit={unit}
                selectedPoint={selectedPoint}
                onPointPress={handlePointPress}
              />
            ) : (
              <View style={styles.emptyChart}>
                <Text style={[Typography.caption, { color: textMuted }]}>
                  {t("chart.empty")}
                </Text>
              </View>
            )}
          </GradientSurface>

          {/* History — plain section, no card wrap. List renders its own header. */}
          <View style={styles.historySection}>
            <MeasurementHistoryList
              data={historyData}
              isLoading={historyLoading}
              unit={unit}
              onEdit={handleEditEntry}
              onDelete={handleDelete}
            />
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>

        <Pressable
          onPress={handleAddPress}
          accessibilityRole="button"
          accessibilityLabel={t("addButton")}
          style={({ pressed }) => [
            styles.fab,
            pressed && { transform: [{ scale: 0.96 }] },
          ]}
        >
          <LinearGradient
            colors={[heroStart, heroEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <IconSymbol name="plus" size={24} color="#FFFFFF" />
        </Pressable>

        <LogMeasurementsModal
          visible={addModalVisible}
          latestData={latestData}
          onSave={handleMultiSave}
          onClose={() => setAddModalVisible(false)}
        />

        <EditMeasurementModal
          visible={editModal.visible}
          field={selectedField}
          initialValue={editModal.value}
          initialDate={editModal.date}
          onSave={handleEditSave}
          onClose={() =>
            setEditModal({
              visible: false,
              date: "",
              originalDate: "",
              value: 0,
            })
          }
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
  hero: {
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  historySection: {
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  emptyChart: {
    height: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomSpacer: {
    height: 80,
  },
  fab: {
    position: "absolute",
    bottom: Platform.select({ ios: 36, android: 24 }),
    right: Spacing.xl,
    width: 56,
    height: 56,
    borderRadius: Radii.full,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
});
