import { useThemeColor } from "@/hooks/use-theme-color";
import { Elevation, Radii, Spacing, Typography } from "@/constants/theme";
import { useCallback, useState, useEffect, useRef } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

interface DurationPickerProps {
  visible: boolean;
  currentSeconds: number | null;
  onSelect: (seconds: number) => void;
  onClose: () => void;
}

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

const PRESETS = [
  { label: "30s", seconds: 30 },
  { label: "1:00", seconds: 60 },
  { label: "1:30", seconds: 90 },
  { label: "2:00", seconds: 120 },
  { label: "3:00", seconds: 180 },
  { label: "5:00", seconds: 300 },
];

function generateRange(max: number): number[] {
  return Array.from({ length: max + 1 }, (_, i) => i);
}

const HOURS = generateRange(23);
const MINUTES = generateRange(59);
const SECONDS = generateRange(59);

interface WheelColumnProps {
  data: number[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  unit: string;
  textColor: string;
  textMuted: string;
  primary: string;
}

function WheelColumn({
  data,
  selectedIndex,
  onSelect,
  unit,
  textColor,
  textMuted,
  primary,
}: WheelColumnProps) {
  const scrollRef = useRef<ScrollView>(null);
  const isUserScrolling = useRef(false);
  const lastReportedIndex = useRef(selectedIndex);

  // Scroll to selected index when it changes externally (not from scrolling)
  useEffect(() => {
    if (!isUserScrolling.current) {
      scrollRef.current?.scrollTo({
        y: selectedIndex * ITEM_HEIGHT,
        animated: false,
      });
    }
  }, [selectedIndex]);

  const handleMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const index = Math.round(y / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(data.length - 1, index));
      isUserScrolling.current = false;
      if (clamped !== lastReportedIndex.current) {
        lastReportedIndex.current = clamped;
        Haptics.selectionAsync();
        onSelect(clamped);
      }
    },
    [data.length, onSelect]
  );

  const handleScrollEndDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const index = Math.round(y / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(data.length - 1, index));
      isUserScrolling.current = false;
      if (clamped !== lastReportedIndex.current) {
        lastReportedIndex.current = clamped;
        Haptics.selectionAsync();
        onSelect(clamped);
      }
    },
    [data.length, onSelect]
  );

  const handleScrollBegin = useCallback(() => {
    isUserScrolling.current = true;
  }, []);

  // Padding so first/last items can center
  const padCount = Math.floor(VISIBLE_ITEMS / 2);

  return (
    <View style={styles.wheelWrapper}>
      <ScrollView
        ref={scrollRef}
        style={styles.wheelScroll}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        nestedScrollEnabled
        onScrollBeginDrag={handleScrollBegin}
        onMomentumScrollEnd={handleMomentumEnd}
        onScrollEndDrag={handleScrollEndDrag}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingVertical: padCount * ITEM_HEIGHT,
        }}
      >
        {data.map((value, i) => {
          const isSelected = i === selectedIndex;
          return (
            <View key={value} style={styles.wheelItem}>
              <Text
                style={[
                  styles.wheelItemText,
                  {
                    color: isSelected ? textColor : textMuted,
                    fontWeight: isSelected ? "700" : "400",
                    fontSize: isSelected ? 24 : 18,
                  },
                ]}
              >
                {String(value).padStart(2, "0")}
              </Text>
            </View>
          );
        })}
      </ScrollView>
      <Text style={[Typography.caption, styles.unitLabel, { color: primary }]}>
        {unit}
      </Text>
    </View>
  );
}

export function DurationPicker({
  visible,
  currentSeconds,
  onSelect,
  onClose,
}: DurationPickerProps) {
  const { t } = useTranslation("workout");
  const background = useThemeColor({}, "backgroundElevated");
  const primary = useThemeColor({}, "primary");
  const primarySurface = useThemeColor({}, "primarySurface");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const textDisabled = useThemeColor({}, "textDisabled");
  const border = useThemeColor({}, "border");
  const inputFill = useThemeColor({}, "inputFill");

  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(30);

  useEffect(() => {
    if (visible) {
      const total = currentSeconds ?? 30;
      setHours(Math.floor(total / 3600));
      setMinutes(Math.floor((total % 3600) / 60));
      setSeconds(total % 60);
    }
  }, [visible, currentSeconds]);

  const totalSeconds = hours * 3600 + minutes * 60 + seconds;

  const handleConfirm = useCallback(() => {
    onSelect(totalSeconds > 0 ? totalSeconds : 0);
    onClose();
  }, [totalSeconds, onSelect, onClose]);

  const handlePreset = useCallback((presetSeconds: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setHours(Math.floor(presetSeconds / 3600));
    setMinutes(Math.floor((presetSeconds % 3600) / 60));
    setSeconds(presetSeconds % 60);
  }, []);

  const formatPreview = useCallback(() => {
    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
    return parts.join(" ");
  }, [hours, minutes, seconds]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouchable} onPress={onClose} />
        <View
          style={[styles.sheet, { backgroundColor: background }, Elevation.md]}
        >
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: textDisabled }]} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={[Typography.titleMd, { color: textColor }]}>
              {t("durationPicker.title")}
            </Text>
            <Text
              style={[
                Typography.titleSm,
                styles.previewText,
                { color: primary },
              ]}
            >
              {formatPreview()}
            </Text>
          </View>

          {/* Quick presets */}
          <View style={styles.presetsSection}>
            <Text
              style={[
                Typography.label,
                { color: textMuted, marginBottom: Spacing.sm },
              ]}
            >
              {t("durationPicker.presets")}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.presetsRow}
            >
              {PRESETS.map((preset) => {
                const isActive = totalSeconds === preset.seconds;
                return (
                  <Pressable
                    key={preset.seconds}
                    onPress={() => handlePreset(preset.seconds)}
                    style={[
                      styles.presetChip,
                      {
                        backgroundColor: isActive ? primarySurface : inputFill,
                        borderColor: isActive ? primary : "transparent",
                      },
                    ]}
                    accessibilityLabel={`Set duration to ${preset.label}`}
                  >
                    <Text
                      style={[
                        Typography.bodyMedium,
                        {
                          color: isActive ? primary : textSecondary,
                        },
                      ]}
                    >
                      {preset.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Scroll wheels */}
          <View style={styles.wheelsContainer} pointerEvents="box-none">
            <View
              pointerEvents="none"
              style={[
                styles.selectionBand,
                {
                  backgroundColor: inputFill,
                  borderColor: border,
                },
              ]}
            />

            <WheelColumn
              data={HOURS}
              selectedIndex={hours}
              onSelect={setHours}
              unit={t("durationPicker.hours")}
              textColor={textColor}
              textMuted={textMuted}
              primary={primary}
            />
            <Text style={[styles.colonSeparator, { color: textMuted }]}>:</Text>
            <WheelColumn
              data={MINUTES}
              selectedIndex={minutes}
              onSelect={setMinutes}
              unit={t("durationPicker.minutes")}
              textColor={textColor}
              textMuted={textMuted}
              primary={primary}
            />
            <Text style={[styles.colonSeparator, { color: textMuted }]}>:</Text>
            <WheelColumn
              data={SECONDS}
              selectedIndex={seconds}
              onSelect={setSeconds}
              unit={t("durationPicker.seconds")}
              textColor={textColor}
              textMuted={textMuted}
              primary={primary}
            />

            {/* Gradient fades top & bottom */}
            <LinearGradient
              colors={[background, `${background}00`]}
              style={styles.fadeTop}
              pointerEvents="none"
            />
            <LinearGradient
              colors={[`${background}00`, background]}
              style={styles.fadeBottom}
              pointerEvents="none"
            />
          </View>

          {/* Confirm button */}
          <Pressable
            onPress={handleConfirm}
            style={[styles.confirmBtn, { backgroundColor: primary }]}
            accessibilityRole="button"
            accessibilityLabel={t("durationPicker.confirm")}
          >
            <Text style={[Typography.titleSm, styles.confirmText]}>
              {t("durationPicker.confirm")}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  backdropTouchable: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: Radii.lg,
    borderTopRightRadius: Radii.lg,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing["4xl"],
    paddingTop: Spacing.md,
    alignItems: "center",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: Radii.full,
    marginBottom: Spacing.lg,
  },
  header: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: Spacing.lg,
  },
  previewText: {
    fontVariant: ["tabular-nums"],
  },
  presetsSection: {
    width: "100%",
    marginBottom: Spacing.xl,
  },
  presetsRow: {
    gap: Spacing.sm,
  },
  presetChip: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: Radii.full,
    borderWidth: 1.5,
  },
  wheelsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: PICKER_HEIGHT,
    width: "100%",
    marginBottom: Spacing["2xl"],
    overflow: "hidden",
  },
  selectionBand: {
    position: "absolute",
    left: 0,
    right: 0,
    top: ITEM_HEIGHT * 2,
    height: ITEM_HEIGHT,
    borderRadius: Radii.sm,
    borderWidth: 1,
  },
  fadeTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT * 1.5,
  },
  fadeBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT * 1.5,
  },
  wheelWrapper: {
    flex: 1,
    alignItems: "center",
    height: PICKER_HEIGHT,
  },
  wheelScroll: {
    height: PICKER_HEIGHT,
    alignSelf: "stretch",
  },
  wheelItem: {
    height: ITEM_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  wheelItemText: {
    fontVariant: ["tabular-nums"],
  },
  unitLabel: {
    position: "absolute",
    bottom: -Spacing.lg,
  },
  colonSeparator: {
    fontSize: 22,
    fontWeight: "600",
    width: 16,
    textAlign: "center",
  },
  confirmBtn: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: Radii.lg,
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  confirmText: {
    color: "#FFFFFF",
  },
});
