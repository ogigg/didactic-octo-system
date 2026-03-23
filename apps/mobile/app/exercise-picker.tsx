import { SearchBar } from "@/components/exercise-picker/search-bar";
import { FilterPills } from "@/components/exercise-picker/filter-pills";
import { FilterSheet } from "@/components/exercise-picker/filter-sheet";
import { ExerciseRow } from "@/components/exercise-picker/exercise-row";
import { useExercises } from "@/hooks/use-exercises-query";
import { useWorkoutStore } from "@/stores/workout-store";
import { useThemeColor } from "@/hooks/use-theme-color";
import { Spacing, Typography } from "@/constants/theme";
import { MUSCLE_GROUPS, EQUIPMENT_TYPES } from "@/constants/exercise-filters";
import type { Exercise } from "@/lib/api/exercises";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { keepPreviousData } from "@tanstack/react-query";

const ROW_HEIGHT = 57;

export default function ExercisePickerScreen() {
  const { t } = useTranslation("exercisePicker");
  const router = useRouter();
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  const replaceExercise = useWorkoutStore((s) => s.replaceExercise);

  const background = useThemeColor({}, "background");
  const primary = useThemeColor({}, "primary");
  const textColor = useThemeColor({}, "text");
  const textMuted = useThemeColor({}, "textMuted");

  // Search state with debounce
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleSearchChange = useCallback((text: string) => {
    setSearchText(text);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedSearch(text), 300);
  }, []);

  // Filter state
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [muscleSheetVisible, setMuscleSheetVisible] = useState(false);
  const [equipmentSheetVisible, setEquipmentSheetVisible] = useState(false);

  // Query
  const { data: exercises, isLoading } = useExercises(
    {
      search: debouncedSearch || undefined,
      muscles: selectedMuscles.length ? selectedMuscles : undefined,
      equipment: selectedEquipment.length ? selectedEquipment : undefined,
    },
    { staleTime: 60_000, placeholderData: keepPreviousData }
  );

  // Handlers
  const handleSelect = useCallback(
    (exercise: Exercise) => {
      if (exerciseId) {
        replaceExercise(exerciseId, {
          id: exercise.id,
          name: exercise.name,
        });
      }
      router.back();
    },
    [exerciseId, replaceExercise, router]
  );

  const handleCancel = useCallback(() => {
    router.back();
  }, [router]);

  const toggleMuscle = useCallback((value: string) => {
    setSelectedMuscles((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }, []);

  const toggleEquipment = useCallback((value: string) => {
    setSelectedEquipment((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }, []);

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: ROW_HEIGHT,
      offset: ROW_HEIGHT * index,
      index,
    }),
    []
  );

  const renderItem = useCallback(
    ({ item }: { item: Exercise }) => (
      <ExerciseRow exercise={item} onSelect={handleSelect} />
    ),
    [handleSelect]
  );

  const keyExtractor = useCallback((item: Exercise) => item.id, []);

  const ListEmptyComponent = useCallback(() => {
    if (isLoading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator color={primary} />
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Text style={[Typography.body, { color: textMuted }]}>
          {t("list.empty")}
        </Text>
      </View>
    );
  }, [isLoading, primary, textMuted, t]);

  return (
    <View style={[styles.root, { backgroundColor: background }]}>
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={handleCancel}
            accessibilityRole="button"
            accessibilityLabel={t("header.cancel")}
            style={styles.headerSide}
          >
            <Text style={[Typography.body, { color: primary }]}>
              {t("header.cancel")}
            </Text>
          </Pressable>
          <Text
            style={[
              Typography.titleMd,
              { color: textColor },
              styles.headerTitle,
            ]}
            numberOfLines={1}
          >
            {t("header.title")}
          </Text>
          <View style={styles.headerSide} />
        </View>

        {/* Search */}
        <SearchBar
          value={searchText}
          onChangeText={handleSearchChange}
          placeholder={t("search.placeholder")}
        />

        {/* Filter Pills */}
        <FilterPills
          selectedMuscles={selectedMuscles}
          selectedEquipment={selectedEquipment}
          onPressMuscles={() => setMuscleSheetVisible(true)}
          onPressEquipment={() => setEquipmentSheetVisible(true)}
        />

        {/* Exercise List */}
        <FlatList
          data={exercises}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListEmptyComponent={ListEmptyComponent}
          contentContainerStyle={styles.listContent}
        />

        {/* Filter Sheets */}
        <FilterSheet
          visible={muscleSheetVisible}
          onClose={() => setMuscleSheetVisible(false)}
          title="Muscle Group"
          options={MUSCLE_GROUPS}
          selected={selectedMuscles}
          onToggle={toggleMuscle}
        />
        <FilterSheet
          visible={equipmentSheetVisible}
          onClose={() => setEquipmentSheetVisible(false)}
          title="Equipment"
          options={EQUIPMENT_TYPES}
          selected={selectedEquipment}
          onToggle={toggleEquipment}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  headerSide: {
    width: 70,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
  },
  listContent: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: Spacing["5xl"],
  },
});
