import { useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { MEASUREMENT_GROUPS } from "@/data/measurements";
import type { MeasurementField } from "@/data/measurements";

interface FieldPillSelectorProps {
  selected: MeasurementField;
  onChange: (field: MeasurementField) => void;
}

export function FieldPillSelector({
  selected,
  onChange,
}: FieldPillSelectorProps) {
  const { t } = useTranslation("measurements");
  const scrollRef = useRef<ScrollView>(null);
  const primary = useThemeColor({}, "primary");
  const primarySurface = useThemeColor({}, "primarySurface");
  const backgroundSubtle = useThemeColor({}, "backgroundSubtle");
  const textColor = useThemeColor({}, "text");
  const textMuted = useThemeColor({}, "textMuted");
  const border = useThemeColor({}, "border");

  return (
    <View style={styles.wrapper}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {MEASUREMENT_GROUPS.map((group, groupIndex) => (
          <View key={group.key} style={styles.groupRow}>
            {groupIndex > 0 && (
              <View style={[styles.divider, { backgroundColor: border }]} />
            )}
            {group.fields.map((field) => {
              const isSelected = field === selected;
              return (
                <Pressable
                  key={field}
                  onPress={() => onChange(field)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={t(`fields.${field}`)}
                  style={[
                    styles.pill,
                    {
                      backgroundColor: isSelected
                        ? primarySurface
                        : backgroundSubtle,
                    },
                    isSelected && { borderColor: primary, borderWidth: 1 },
                  ]}
                >
                  <Text
                    style={[
                      Typography.caption,
                      styles.pillText,
                      { color: isSelected ? primary : textMuted },
                    ]}
                    numberOfLines={1}
                  >
                    {t(`fields.${field}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: -Spacing.xl,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.xs,
    flexDirection: "row",
    alignItems: "center",
  },
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  divider: {
    width: 1,
    height: 20,
    marginHorizontal: Spacing.sm,
    borderRadius: 1,
    opacity: 0.5,
  },
  pill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: "transparent",
  },
  pillText: {
    fontWeight: "500",
  },
});
