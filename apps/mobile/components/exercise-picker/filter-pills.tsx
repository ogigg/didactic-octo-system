import { useThemeColor } from "@/hooks/use-theme-color";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

interface FilterPillsProps {
  favoritesOnly: boolean;
  searchText: string;
  selectedMuscles: string[];
  selectedEquipment: string[];
  muscleLabels: ReadonlyMap<string, string>;
  equipmentLabels: ReadonlyMap<string, string>;
  onPressFavorites: () => void;
  onPressMuscles: () => void;
  onPressEquipment: () => void;
  onRemoveSearch: () => void;
  onRemoveFavorite: () => void;
  onRemoveMuscle: (muscle: string) => void;
  onRemoveEquipment: (equipment: string) => void;
  onClearAll: () => void;
}

export function FilterPills({
  favoritesOnly,
  searchText,
  selectedMuscles,
  selectedEquipment,
  muscleLabels,
  equipmentLabels,
  onPressFavorites,
  onPressMuscles,
  onPressEquipment,
  onRemoveSearch,
  onRemoveFavorite,
  onRemoveMuscle,
  onRemoveEquipment,
  onClearAll,
}: FilterPillsProps) {
  const { t } = useTranslation("exercisePicker");
  const backgroundSubtle = useThemeColor({}, "backgroundSubtle");
  const primarySurface = useThemeColor({}, "primarySurface");
  const textColor = useThemeColor({}, "text");
  const primary = useThemeColor({}, "primary");
  const border = useThemeColor({}, "border");

  const musclesActive = selectedMuscles.length > 0;
  const equipmentActive = selectedEquipment.length > 0;
  const favoritesLabel = t("filters.favorites");
  const hasActiveFilters =
    searchText.length > 0 || favoritesOnly || musclesActive || equipmentActive;

  const musclesLabel = musclesActive
    ? t("filters.musclesSelected", { count: selectedMuscles.length })
    : t("filters.allMuscles");

  const equipmentLabel = equipmentActive
    ? t("filters.equipmentSelected", { count: selectedEquipment.length })
    : t("filters.allEquipment");

  const pillStyle = (active: boolean) => [
    styles.pill,
    {
      backgroundColor: active ? primarySurface : backgroundSubtle,
      borderColor: active ? primary : border,
    },
  ];

  const renderActiveChip = (
    key: string,
    label: string,
    onRemove: () => void
  ) => (
    <Pressable
      key={key}
      onPress={onRemove}
      accessibilityRole="button"
      accessibilityLabel={t("filters.removeFilter", { filter: label })}
      style={[
        styles.activeChip,
        { backgroundColor: primarySurface, borderColor: primary },
      ]}
    >
      <Text
        style={[Typography.caption, styles.activeChipText, { color: primary }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <IconSymbol name="xmark" size={11} color={primary} />
    </Pressable>
  );

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={onPressFavorites}
          accessibilityRole="button"
          accessibilityLabel={favoritesLabel}
          accessibilityState={{ selected: favoritesOnly }}
          style={pillStyle(favoritesOnly)}
        >
          <IconSymbol
            name={favoritesOnly ? "heart.fill" : "heart"}
            size={15}
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
          accessibilityState={{ selected: equipmentActive }}
          style={pillStyle(equipmentActive)}
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
          <IconSymbol
            name="chevron.down"
            size={11}
            color={equipmentActive ? primary : textColor}
          />
        </Pressable>
        <Pressable
          onPress={onPressMuscles}
          accessibilityRole="button"
          accessibilityLabel={musclesLabel}
          accessibilityState={{ selected: musclesActive }}
          style={pillStyle(musclesActive)}
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
          <IconSymbol
            name="chevron.down"
            size={11}
            color={musclesActive ? primary : textColor}
          />
        </Pressable>
      </ScrollView>
      {hasActiveFilters ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.activeList}
          keyboardShouldPersistTaps="handled"
        >
          {searchText
            ? renderActiveChip(
                "search",
                t("filters.searchChip", { query: searchText }),
                onRemoveSearch
              )
            : null}
          {favoritesOnly
            ? renderActiveChip("favorites", favoritesLabel, onRemoveFavorite)
            : null}
          {selectedMuscles.map((muscle) =>
            renderActiveChip(
              `muscle:${muscle}`,
              muscleLabels.get(muscle) ?? muscle,
              () => onRemoveMuscle(muscle)
            )
          )}
          {selectedEquipment.map((equipment) =>
            renderActiveChip(
              `equipment:${equipment}`,
              equipmentLabels.get(equipment) ?? equipment,
              () => onRemoveEquipment(equipment)
            )
          )}
          <Pressable
            onPress={onClearAll}
            accessibilityRole="button"
            accessibilityLabel={t("filters.clearAll")}
            style={styles.clearAll}
          >
            <Text
              style={[
                Typography.caption,
                styles.clearAllText,
                { color: primary },
              ]}
            >
              {t("filters.clearAll")}
            </Text>
          </Pressable>
        </ScrollView>
      ) : null}
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
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs + 2,
    minHeight: 38,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radii.full,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  pillText: {
    ...Typography.bodyMedium,
  },
  activeList: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.sm,
  },
  activeChip: {
    maxWidth: 220,
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs + 2,
    borderRadius: Radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.md,
  },
  activeChipText: {
    flexShrink: 1,
    fontWeight: "500",
  },
  clearAll: {
    minHeight: 30,
    justifyContent: "center",
    paddingHorizontal: Spacing.sm,
  },
  clearAllText: {
    fontWeight: "600",
  },
});
