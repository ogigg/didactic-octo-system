import { useThemeColor } from "@/hooks/use-theme-color";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

interface FilterPillsProps {
  favoritesOnly: boolean;
  selectedMuscles: string[];
  selectedEquipment: string[];
  onPressFavorites: () => void;
  onPressMuscles: () => void;
  onPressEquipment: () => void;
}

export function FilterPills({
  favoritesOnly,
  selectedMuscles,
  selectedEquipment,
  onPressFavorites,
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
  const favoritesLabel = t("filters.favorites");

  const musclesLabel = musclesActive
    ? t("filters.musclesSelected", { count: selectedMuscles.length })
    : t("filters.allMuscles");

  const equipmentLabel = equipmentActive
    ? t("filters.equipmentSelected", { count: selectedEquipment.length })
    : t("filters.allEquipment");

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onPressFavorites}
        accessibilityRole="button"
        accessibilityLabel={favoritesLabel}
        accessibilityState={{ selected: favoritesOnly }}
        style={[
          styles.pill,
          styles.favoritesPill,
          {
            backgroundColor: favoritesOnly ? primarySurface : backgroundSubtle,
          },
        ]}
      >
        <IconSymbol
          name={favoritesOnly ? "heart.fill" : "heart"}
          size={16}
          color={favoritesOnly ? primary : textColor}
        />
        <Text
          style={[
            styles.pillText,
            { color: favoritesOnly ? primary : textColor },
          ]}
          numberOfLines={1}
        >
          {favoritesLabel}
        </Text>
      </Pressable>
      <Pressable
        onPress={onPressEquipment}
        accessibilityRole="button"
        accessibilityLabel={equipmentLabel}
        style={[
          styles.pill,
          styles.flexPill,
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
          numberOfLines={1}
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
          styles.flexPill,
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
          numberOfLines={1}
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
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: Radii.sm,
  },
  favoritesPill: {
    flexDirection: "row",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  flexPill: {
    flex: 1,
    paddingHorizontal: Spacing.sm,
  },
  pillText: {
    ...Typography.body,
    fontWeight: "500",
  },
});
