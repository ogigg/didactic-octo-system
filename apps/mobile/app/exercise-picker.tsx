import { SearchBar } from "@/components/exercise-picker/search-bar";
import { FilterPills } from "@/components/exercise-picker/filter-pills";
import { FilterSheet } from "@/components/exercise-picker/filter-sheet";
import { ExerciseRow } from "@/components/exercise-picker/exercise-row";
import { useExercise, useExercises } from "@/hooks/use-exercises-query";
import { useWorkoutStore } from "@/stores/workout-store";
import { usePendingSwapStore } from "@/stores/pending-swap-store";
import { useThemeColor } from "@/hooks/use-theme-color";
import { Spacing, Typography } from "@/constants/theme";
import { MUSCLE_GROUPS, EQUIPMENT_TYPES } from "@/constants/exercise-filters";
import type { Exercise } from "@/lib/api/exercises";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { keepPreviousData } from "@tanstack/react-query";

const MAX_SUGGESTIONS = 5;

// "replace" = replacing an exercise in active workout (shows suggestions)
// "add" = adding exercise to a training plan (no suggestions)
// "pending_swap" = swapping exercise in pending workout preview (stores result, no store mutation)
type PickerMode = "replace" | "add" | "pending_swap";

export default function ExercisePickerScreen() {
  const { t } = useTranslation("exercisePicker");
  const router = useRouter();
  const { exerciseId, mode: modeParam } = useLocalSearchParams<{
    exerciseId?: string;
    mode?: string;
  }>();
  const mode: PickerMode =
    modeParam === "pending_swap"
      ? "pending_swap"
      : modeParam === "add"
        ? "add"
        : "replace";
  const replaceExercise = useWorkoutStore((s) => s.replaceExercise);
  const addExercise = useWorkoutStore((s) => s.addExercise);
  const setSwapResult = usePendingSwapStore((s) => s.setResult);

  // Fetch current exercise details for suggestion ranking (replace mode only)
  const { data: currentExercise } = useExercise(
    mode === "replace" && exerciseId ? exerciseId : ""
  );

  const background = useThemeColor({}, "background");
  const primary = useThemeColor({}, "primary");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
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

  const hasActiveFilters =
    debouncedSearch.length > 0 ||
    selectedMuscles.length > 0 ||
    selectedEquipment.length > 0;

  // Query
  const { data: exercises, isLoading } = useExercises(
    {
      search: debouncedSearch || undefined,
      muscles: selectedMuscles.length ? selectedMuscles : undefined,
      equipment: selectedEquipment.length ? selectedEquipment : undefined,
    },
    { staleTime: 60_000, placeholderData: keepPreviousData }
  );

  // Split into suggested + all sections
  const sections = useMemo(() => {
    if (!exercises) return [];

    // Exclude the current exercise from results
    const filtered = exerciseId
      ? exercises.filter((ex) => ex.id !== exerciseId)
      : exercises;

    // Skip suggestions in add mode, or when filters are active
    if (mode === "add" || hasActiveFilters || !currentExercise) {
      return [{ title: t("sections.allExercises"), data: filtered }];
    }

    // Build suggested: exercises sharing a primary muscle, ranked by equipment overlap
    const muscleSet = new Set(currentExercise.primary_muscles);
    const equipmentSet = new Set(currentExercise.equipment);

    const muscleMatches = filtered.filter((ex) =>
      ex.primary_muscles.some((m) => muscleSet.has(m))
    );

    // Score by equipment overlap: more shared equipment = higher rank
    const scored = muscleMatches.map((ex) => {
      const equipmentScore = ex.equipment.filter((e) =>
        equipmentSet.has(e)
      ).length;
      return { exercise: ex, equipmentScore };
    });

    scored.sort((a, b) => b.equipmentScore - a.equipmentScore);

    const suggested = scored.slice(0, MAX_SUGGESTIONS).map((s) => s.exercise);
    const suggestedIds = new Set(suggested.map((s) => s.id));
    const rest = filtered.filter((ex) => !suggestedIds.has(ex.id));

    const result: { title: string; data: Exercise[] }[] = [];
    if (suggested.length > 0) {
      result.push({ title: t("sections.suggested"), data: suggested });
    }
    result.push({ title: t("sections.allExercises"), data: rest });
    return result;
  }, [exercises, exerciseId, mode, hasActiveFilters, currentExercise, t]);

  // Handlers
  const handleSelect = useCallback(
    (exercise: Exercise) => {
      if (mode === "pending_swap") {
        setSwapResult({ id: exercise.id, name: exercise.name });
        router.back();
        return;
      }
      if (mode === "add") {
        addExercise({
          id: exercise.id,
          name: exercise.name,
          exerciseType: exercise.exercise_type,
        });
      } else if (exerciseId) {
        replaceExercise(exerciseId, {
          id: exercise.id,
          name: exercise.name,
          exerciseType: exercise.exercise_type,
        });
      }
      router.back();
    },
    [mode, exerciseId, addExercise, replaceExercise, router, setSwapResult]
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

  const renderItem = useCallback(
    ({ item }: { item: Exercise }) => (
      <ExerciseRow exercise={item} onSelect={handleSelect} mode={mode} />
    ),
    [handleSelect, mode]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: { title: string } }) => (
      <View style={styles.sectionHeader}>
        <Text style={[Typography.titleSm, { color: textSecondary }]}>
          {section.title}
        </Text>
      </View>
    ),
    [textSecondary]
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
      <SafeAreaProvider>
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
              {mode === "add" ? t("header.titleAdd") : t("header.titleReplace")}
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
          <SectionList
            sections={sections}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            renderSectionHeader={renderSectionHeader}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            ListEmptyComponent={ListEmptyComponent}
            contentContainerStyle={styles.listContent}
            stickySectionHeadersEnabled={false}
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
      </SafeAreaProvider>
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
  sectionHeader: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: Spacing["4xl"],
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: Spacing["5xl"],
  },
});
