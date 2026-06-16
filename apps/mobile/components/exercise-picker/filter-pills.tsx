import { useThemeColor } from "@/hooks/use-theme-color";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

interface FilterPillsProps {
  selectedMuscles: string[];
  selectedEquipment: string[];
  onPressMuscles: () => void;
  onPressEquipment: () => void;
}

export function FilterPills({
  selectedMuscles,
  selectedEquipment,
  onPressMuscles,
  onPressEquipment,
}: FilterPillsProps) {
  const { t } = useTranslation("exercisePicker");
  const backgroundSubtle = useThemeColor({}, "backgroundSubtle");
  const primarySurface = useThemeColor({}, "primarySurface");
  const textColor = useThemeColor({}, "text");
  const primary = useThemeColor({}, "primary");

  const musclesActive = selectedMuscles.length > 0;
  const equipmentActive = selectedEquipment.length > 0;

  const musclesLabel = musclesActive
    ? t("filters.musclesSelected", { count: selectedMuscles.length })
    : t("filters.allMuscles");

  const equipmentLabel = equipmentActive
    ? t("filters.equipmentSelected", { count: selectedEquipment.length })
    : t("filters.allEquipment");

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onPressEquipment}
        accessibilityRole="button"
        accessibilityLabel={equipmentLabel}
        style={[
          styles.pill,
          {
            backgroundColor: equipmentActive
              ? primarySurface
              : backgroundSubtle,
          },
        ]}
      >
        <Text
          style={[
            styles.pillText,
            { color: equipmentActive ? primary : textColor },
          ]}
        >
          {equipmentLabel}
        </Text>
      </Pressable>
      <Pressable
        onPress={onPressMuscles}
        accessibilityRole="button"
        accessibilityLabel={musclesLabel}
        style={[
          styles.pill,
          {
            backgroundColor: musclesActive ? primarySurface : backgroundSubtle,
          },
        ]}
      >
        <Text
          style={[
            styles.pillText,
            { color: musclesActive ? primary : textColor },
          ]}
        >
          {musclesLabel}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
  },
  pill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: Radii.sm,
  },
  pillText: {
    ...Typography.body,
    fontWeight: "500",
  },
});
