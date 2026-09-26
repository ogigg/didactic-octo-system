import { useTranslation } from "react-i18next";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AmbientGlow } from "@/components/ambient-glow";
import { ListGroup, ListRow } from "@/components/ui/list-row";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useWatchStatus } from "@/hooks/use-watch-status";
import {
  useWatchSettingsStore,
  type WatchSettingsState,
} from "@/stores/watch-settings-store";

type RestWarningSeconds = WatchSettingsState["restWarningSeconds"];
type RestAdjustmentSeconds = WatchSettingsState["restAdjustmentSeconds"];
type RestCompletionBehavior = WatchSettingsState["restCompletionBehavior"];

const REST_WARNING_VALUES: readonly RestWarningSeconds[] = [0, 5, 10, 15, 30];
const REST_ADJUSTMENT_VALUES: readonly RestAdjustmentSeconds[] = [10, 15, 30];
const REST_COMPLETION_VALUES: readonly RestCompletionBehavior[] = [
  "stayOnTimer",
  "openNextSet",
];

interface ChoiceOptionProps {
  value: string;
  selected: boolean;
  label: string;
  onPress: () => void;
  disabled: boolean;
  accessibilityHint: string;
}

function ChoiceOption({
  value,
  selected,
  label,
  onPress,
  disabled,
  accessibilityHint,
}: ChoiceOptionProps) {
  const primary = useThemeColor({}, "primary");
  const primaryContainer = useThemeColor({}, "primaryContainer");
  const textSecondary = useThemeColor({}, "textSecondary");

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityLabel={`${label}, ${value}`}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ checked: selected, selected, disabled }}
      style={({ pressed }) => [
        styles.choiceOption,
        selected && { backgroundColor: primaryContainer },
        pressed && !disabled && { opacity: 0.75 },
        disabled && { opacity: 0.5 },
      ]}
    >
      <Text
        style={[
          Typography.caption,
          styles.choiceOptionLabel,
          { color: selected ? primary : textSecondary },
        ]}
      >
        {value}
      </Text>
    </Pressable>
  );
}

interface ChoiceRowProps {
  label: string;
  description: string;
  selectedValue: string;
  options: readonly string[];
  onSelect: (value: string) => void;
  disabled: boolean;
  accessibilityHint: string;
  accessibilityLabel?: string;
}

function ChoiceRow({
  label,
  description,
  selectedValue,
  options,
  onSelect,
  disabled,
  accessibilityHint,
  accessibilityLabel,
}: ChoiceRowProps) {
  return (
    <ListRow
      label={label}
      description={description}
      showChevron={false}
      trailing={
        <View
          style={styles.choiceOptions}
          accessible
          accessibilityRole="radiogroup"
          accessibilityLabel={
            accessibilityLabel ?? `${label}, ${selectedValue}`
          }
        >
          {options.map((value) => (
            <ChoiceOption
              key={value}
              value={value}
              label={label}
              selected={value === selectedValue}
              onPress={() => onSelect(value)}
              disabled={disabled}
              accessibilityHint={accessibilityHint}
            />
          ))}
        </View>
      }
      accessibilityLabel={accessibilityLabel ?? `${label}, ${selectedValue}`}
    />
  );
}

interface SwitchRowProps {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled: boolean;
  accessibilityHint: string;
}

function SwitchRow({
  label,
  description,
  value,
  onValueChange,
  disabled,
  accessibilityHint,
}: SwitchRowProps) {
  const primary = useThemeColor({}, "primary");
  const textMuted = useThemeColor({}, "textMuted");
  const backgroundElevated = useThemeColor({}, "backgroundElevated");

  return (
    <ListRow
      label={label}
      description={description}
      showChevron={false}
      trailing={
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          accessibilityRole="switch"
          accessibilityLabel={label}
          accessibilityHint={accessibilityHint}
          accessibilityState={{ checked: value, disabled }}
          trackColor={{ false: textMuted, true: primary }}
          thumbColor={backgroundElevated}
        />
      }
      accessibilityLabel={label}
    />
  );
}

export default function WatchSettingsScreen() {
  const { t } = useTranslation("watchSettings");
  const { platformSupported, paired, installed, reachable, loading } =
    useWatchStatus();
  const {
    restWarningSeconds,
    restEndHapticsEnabled,
    restAdjustmentSeconds,
    autoShowRestTimer,
    restCompletionBehavior,
    setCompletionHapticsEnabled,
    confirmSkipRest,
    confirmEndWorkout,
    showHeartRate,
    showPreviousPerformance,
    setRestWarningSeconds,
    setRestEndHapticsEnabled,
    setRestAdjustmentSeconds,
    setAutoShowRestTimer,
    setRestCompletionBehavior,
    setSetCompletionHapticsEnabled,
    setConfirmSkipRest,
    setConfirmEndWorkout,
    setShowHeartRate,
    setShowPreviousPerformance,
  } = useWatchSettingsStore();

  const background = useThemeColor({}, "background");
  const backgroundSubtle = useThemeColor({}, "backgroundSubtle");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const border = useThemeColor({}, "border");
  const success = useThemeColor({}, "success");

  const warningLabels: Record<RestWarningSeconds, string> = {
    0: t("restTimer.warning.off"),
    5: t("restTimer.warning.five"),
    10: t("restTimer.warning.ten"),
    15: t("restTimer.warning.fifteen"),
    30: t("restTimer.warning.thirty"),
  };
  const adjustmentLabels: Record<RestAdjustmentSeconds, string> = {
    10: t("restTimer.adjustment.ten"),
    15: t("restTimer.adjustment.fifteen"),
    30: t("restTimer.adjustment.thirty"),
  };
  const completionLabels: Record<RestCompletionBehavior, string> = {
    stayOnTimer: t("restTimer.completion.stayOnTimer"),
    openNextSet: t("restTimer.completion.openNextSet"),
  };

  const statusCopy = loading
    ? t("status.checking")
    : !platformSupported
      ? t("status.nonIos")
      : !paired
        ? t("status.notPaired")
        : !installed
          ? t("status.notInstalled")
          : reachable
            ? t("status.ready")
            : t("status.unreachable");
  const isReady =
    !loading && platformSupported && paired && installed && reachable;
  const controlsDisabled = !platformSupported;

  return (
    <View style={[styles.root, { backgroundColor: background }]}>
      <AmbientGlow variant="subtle" />
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title={t("title")} titleStyle={Typography.titleMd} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.statusCard,
              { backgroundColor: backgroundSubtle, borderColor: border },
            ]}
          >
            <View style={styles.statusHeader}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isReady ? success : textMuted },
                ]}
              />
              <Text style={[Typography.titleSm, { color: textColor }]}>
                {statusCopy}
              </Text>
            </View>
            <Text style={[Typography.caption, { color: textSecondary }]}>
              {platformSupported ? t("helper.queued") : t("helper.unavailable")}
            </Text>
          </View>

          <Text style={[Typography.body, { color: textSecondary }]}>
            {t("intro")}
          </Text>

          <View style={styles.group}>
            <Text style={[Typography.titleSm, { color: textColor }]}>
              {t("sections.restTimer")}
            </Text>
            <ListGroup>
              <ChoiceRow
                label={t("restTimer.warning.label")}
                description={t("restTimer.warning.description")}
                selectedValue={warningLabels[restWarningSeconds]}
                options={REST_WARNING_VALUES.map(
                  (value) => warningLabels[value]
                )}
                onSelect={(value) => {
                  const selected = REST_WARNING_VALUES.find(
                    (option) => warningLabels[option] === value
                  );
                  if (selected !== undefined) setRestWarningSeconds(selected);
                }}
                disabled={controlsDisabled}
                accessibilityHint={t("restTimer.warning.description")}
                accessibilityLabel={t("restTimer.warning.accessibility", {
                  label: t("restTimer.warning.label"),
                  value: warningLabels[restWarningSeconds],
                })}
              />
              <SwitchRow
                label={t("restTimer.endHaptics.label")}
                description={t("restTimer.endHaptics.description")}
                value={restEndHapticsEnabled}
                onValueChange={setRestEndHapticsEnabled}
                disabled={controlsDisabled}
                accessibilityHint={t("restTimer.endHaptics.accessibilityHint")}
              />
              <ChoiceRow
                label={t("restTimer.adjustment.label")}
                description={t("restTimer.adjustment.description")}
                selectedValue={adjustmentLabels[restAdjustmentSeconds]}
                options={REST_ADJUSTMENT_VALUES.map(
                  (value) => adjustmentLabels[value]
                )}
                onSelect={(value) => {
                  const selected = REST_ADJUSTMENT_VALUES.find(
                    (option) => adjustmentLabels[option] === value
                  );
                  if (selected !== undefined)
                    setRestAdjustmentSeconds(selected);
                }}
                disabled={controlsDisabled}
                accessibilityHint={t("restTimer.adjustment.description")}
                accessibilityLabel={t("restTimer.adjustment.accessibility", {
                  label: t("restTimer.adjustment.label"),
                  value: adjustmentLabels[restAdjustmentSeconds],
                })}
              />
              <SwitchRow
                label={t("restTimer.autoShow.label")}
                description={t("restTimer.autoShow.description")}
                value={autoShowRestTimer}
                onValueChange={setAutoShowRestTimer}
                disabled={controlsDisabled}
                accessibilityHint={t("restTimer.autoShow.accessibilityHint")}
              />
              <ChoiceRow
                label={t("restTimer.completion.label")}
                description={t("restTimer.completion.description")}
                selectedValue={completionLabels[restCompletionBehavior]}
                options={REST_COMPLETION_VALUES.map(
                  (value) => completionLabels[value]
                )}
                onSelect={(value) => {
                  const selected = REST_COMPLETION_VALUES.find(
                    (option) => completionLabels[option] === value
                  );
                  if (selected !== undefined)
                    setRestCompletionBehavior(selected);
                }}
                disabled={controlsDisabled}
                accessibilityHint={t("restTimer.completion.description")}
                accessibilityLabel={t("restTimer.completion.accessibility", {
                  label: t("restTimer.completion.label"),
                  value: completionLabels[restCompletionBehavior],
                })}
              />
            </ListGroup>
          </View>

          <View style={styles.group}>
            <Text style={[Typography.titleSm, { color: textColor }]}>
              {t("sections.workoutInteraction")}
            </Text>
            <ListGroup>
              <SwitchRow
                label={t("workoutInteraction.setHaptics.label")}
                description={t("workoutInteraction.setHaptics.description")}
                value={setCompletionHapticsEnabled}
                onValueChange={setSetCompletionHapticsEnabled}
                disabled={controlsDisabled}
                accessibilityHint={t(
                  "workoutInteraction.setHaptics.accessibilityHint"
                )}
              />
              <SwitchRow
                label={t("workoutInteraction.skipConfirmation.label")}
                description={t(
                  "workoutInteraction.skipConfirmation.description"
                )}
                value={confirmSkipRest}
                onValueChange={setConfirmSkipRest}
                disabled={controlsDisabled}
                accessibilityHint={t(
                  "workoutInteraction.skipConfirmation.accessibilityHint"
                )}
              />
              <SwitchRow
                label={t("workoutInteraction.endConfirmation.label")}
                description={t(
                  "workoutInteraction.endConfirmation.description"
                )}
                value={confirmEndWorkout}
                onValueChange={setConfirmEndWorkout}
                disabled={controlsDisabled}
                accessibilityHint={t(
                  "workoutInteraction.endConfirmation.accessibilityHint"
                )}
              />
            </ListGroup>
          </View>

          <View style={styles.group}>
            <Text style={[Typography.titleSm, { color: textColor }]}>
              {t("sections.display")}
            </Text>
            <ListGroup>
              <SwitchRow
                label={t("display.heartRate.label")}
                description={t("display.heartRate.description")}
                value={showHeartRate}
                onValueChange={setShowHeartRate}
                disabled={controlsDisabled}
                accessibilityHint={t("display.heartRate.accessibilityHint")}
              />
              <SwitchRow
                label={t("display.previousPerformance.label")}
                description={t("display.previousPerformance.description")}
                value={showPreviousPerformance}
                onValueChange={setShowPreviousPerformance}
                disabled={controlsDisabled}
                accessibilityHint={t(
                  "display.previousPerformance.accessibilityHint"
                )}
              />
            </ListGroup>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing["3xl"],
    gap: Spacing.xl,
  },
  statusCard: {
    borderRadius: Radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  group: { gap: Spacing.md },
  choiceOptions: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: Spacing.xs,
    maxWidth: 190,
  },
  choiceOption: {
    minHeight: 30,
    minWidth: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.sm,
  },
  choiceOptionLabel: { fontWeight: "600" },
});
