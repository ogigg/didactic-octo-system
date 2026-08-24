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
      style={[styles.activeChip, { backgroundColor: primarySurface }]}
    >
      <Text
        style={[Typography.caption, styles.activeChipText, { color: primary }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <IconSymbol name="xmark" size={12} color={primary} />
    </Pressable>
  );

  return (
    <View>
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
              backgroundColor: favoritesOnly
                ? primarySurface
                : backgroundSubtle,
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
          accessibilityState={{ selected: equipmentActive }}
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
          accessibilityState={{ selected: musclesActive }}
          style={[
            styles.pill,
            styles.flexPill,
            {
              backgroundColor: musclesActive
                ? primarySurface
                : backgroundSubtle,
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
      {hasActiveFilters ? (
        <View style={styles.activeRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.activeScroll}
            contentContainerStyle={styles.activeList}
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
          </ScrollView>
          <Pressable
            onPress={onClearAll}
            accessibilityRole="button"
            accessibilityLabel={t("filters.clearAll")}
            style={styles.clearAll}
          >
            <Text style={[Typography.caption, { color: primary }]}>
              {t("filters.clearAll")}
            </Text>
          </Pressable>
        </View>
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
  activeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  activeList: {
    gap: Spacing.sm,
    paddingLeft: Spacing.xl,
  },
  activeScroll: {
    flex: 1,
  },
  activeChip: {
    maxWidth: 180,
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.md,
  },
  activeChipText: {
    flexShrink: 1,
    fontWeight: "500",
  },
  clearAll: {
    minHeight: 32,
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
});
