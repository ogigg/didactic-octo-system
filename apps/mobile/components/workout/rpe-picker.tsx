import {
  AppBottomSheet,
  type AppBottomSheetHandle,
} from "@/components/ui/app-bottom-sheet";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useThemeColor } from "@/hooks/use-theme-color";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

const RPE_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

interface RpePickerProps {
  visible: boolean;
  currentValue: number | null;
  onSelect: (value: number) => void;
  onClose: () => void;
}

export function RpePicker({
  visible,
  currentValue,
  onSelect,
  onClose,
}: RpePickerProps) {
  const { t } = useTranslation("workout");
  const sheetRef = useRef<AppBottomSheetHandle>(null);
  const primary = useThemeColor({}, "primary");
  const primarySurface = useThemeColor({}, "primarySurface");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const borderSubtle = useThemeColor({}, "borderSubtle");

  return (
    <AppBottomSheet
      ref={sheetRef}
      visible={visible}
      onClose={onClose}
      closeAccessibilityLabel={t("rpe.close")}
      testID="rpe-picker-sheet"
    >
      <View style={styles.container}>
        <Text style={[Typography.titleSm, { color: textColor }]}>
          {t("rpe.title")}
        </Text>
        <View
          style={[
            styles.help,
            { backgroundColor: primarySurface, borderColor: borderSubtle },
          ]}
        >
          <IconSymbol
            name="questionmark.circle.fill"
            size={18}
            color={primary}
          />
          <Text style={[styles.helpText, { color: textSecondary }]}>
            {t("rpe.explanation")}
          </Text>
        </View>
        <View style={styles.grid}>
          {RPE_VALUES.map((val) => {
            const isSelected = val === currentValue;
            return (
              <Pressable
                key={val}
                onPress={() => {
                  sheetRef.current?.dismiss(() => onSelect(val));
                }}
                accessibilityRole="button"
                accessibilityLabel={`RPE ${val}`}
                accessibilityState={{ selected: isSelected }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: isSelected ? primarySurface : borderSubtle,
                    borderColor: isSelected ? primary : "transparent",
                  },
                ]}
              >
                <Text
                  style={[
                    Typography.bodyMedium,
                    {
                      color: isSelected ? primary : textSecondary,
                    },
                  ]}
                >
                  {val}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
    gap: Spacing.lg,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    justifyContent: "center",
  },
  help: {
    borderWidth: 1,
    borderRadius: Radii.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    maxWidth: 280,
  },
  helpText: {
    ...Typography.caption,
    flex: 1,
    lineHeight: 17,
  },
  chip: {
    width: 48,
    height: 48,
    borderRadius: Radii.full,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
});
