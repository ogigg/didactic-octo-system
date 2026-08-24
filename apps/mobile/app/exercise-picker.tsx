import { SearchBar } from "@/components/exercise-picker/search-bar";
import { FilterPills } from "@/components/exercise-picker/filter-pills";
import { FilterSheet } from "@/components/exercise-picker/filter-sheet";
import { ExerciseRow } from "@/components/exercise-picker/exercise-row";
import {
  useExercise,
  useExerciseFilterOptions,
  useExercises,
} from "@/hooks/use-exercises-query";
import { useExercisePreferences } from "@/hooks/use-exercise-preference-query";
import { useProfile } from "@/hooks/use-profile-query";
import {
  EXERCISE_PREFERENCE,
  type ExercisePreferenceValue,
} from "@/lib/api/exercise-preferences";
import { fetchPreviousSetDisplays } from "@/lib/api/workouts";
import { useWorkoutStore } from "@/stores/workout-store";
import { usePendingSwapStore } from "@/stores/pending-swap-store";
import { useThemeColor } from "@/hooks/use-theme-color";
import type { WeightUnit } from "@/lib/unit-conversion";
import type { ExercisePreviousSets } from "@/lib/workout-previous-sets";
import { Spacing, Typography } from "@/constants/theme";
import type { Exercise } from "@/lib/api/exercises";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  const {
    exerciseId,
    occurrenceId,
    mode: modeParam,
  } = useLocalSearchParams<{
    exerciseId?: string;
    occurrenceId?: string;
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
  const addExerciseAfter = useWorkoutStore((s) => s.addExerciseAfter);
  const workoutExercises = useWorkoutStore((s) => s.exercises);
  const setSwapResult = usePendingSwapStore((s) => s.setResult);
  const { data: profile } = useProfile();
  const weightUnit: WeightUnit = (profile?.weight_unit as WeightUnit) ?? "kg";
  const {
    filterOptions,
    labelMaps,
    isLoading: isFilterOptionsLoading,
  } = useExerciseFilterOptions();
  const activeExercise = useMemo(
    () =>
      workoutExercises.find(
        (exercise) =>
          exercise.occurrenceId === occurrenceId ||
          (!occurrenceId && exercise.id === exerciseId)
      ),
    [exerciseId, occurrenceId, workoutExercises]
  );

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

  const handleClearSearch = useCallback(() => {
    clearTimeout(timerRef.current);
    setSearchText("");
    setDebouncedSearch("");
  }, []);

  // Filter state
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [muscleSheetVisible, setMuscleSheetVisible] = useState(false);
  const [equipmentSheetVisible, setEquipmentSheetVisible] = useState(false);

  const { data: preferencesMap, isLoading: isPreferencesLoading } =
    useExercisePreferences();
  const preferredIds = useMemo(
    () => getPreferredExerciseIds(preferencesMap),
    [preferencesMap]
  );

  const hasActiveFilters =
    debouncedSearch.length > 0 ||
    selectedMuscles.length > 0 ||
    selectedEquipment.length > 0 ||
    favoritesOnly;

  // Query
  const { data: exercises, isLoading: isExercisesLoading } = useExercises(
    {
      search: debouncedSearch || undefined,
      muscles: selectedMuscles.length ? selectedMuscles : undefined,
      equipment: selectedEquipment.length ? selectedEquipment : undefined,
    },
    { staleTime: 60_000, placeholderData: keepPreviousData }
  );
  const isLoading =
    isExercisesLoading || (favoritesOnly && isPreferencesLoading);

  // Split into suggested + all sections
  const sections = useMemo(() => {
    if (!exercises) return [];

    // Exclude the current exercise from results
    let filtered = exerciseId
      ? exercises.filter((ex) => ex.id !== exerciseId)
      : exercises;

    if (favoritesOnly) {
      filtered = filtered.filter((ex) => preferredIds.has(ex.id));
    }

    if (filtered.length === 0) return [];

    const listTitle = favoritesOnly
      ? t("sections.favorites")
      : t("sections.allExercises");

    // Skip suggestions in add mode, or when filters are active
    if (mode === "add" || hasActiveFilters || !currentExercise) {
      return [{ title: listTitle, data: filtered }];
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
  }, [
    exercises,
    exerciseId,
    mode,
    hasActiveFilters,
    currentExercise,
    favoritesOnly,
    preferredIds,
    t,
  ]);

  // Handlers
  const hasLoggedValues = useCallback(() => {
    if (!activeExercise) return false;
    return activeExercise.sets.some(
      (set) =>
        set.isCompleted ||
        set.kg.trim().length > 0 ||
        set.reps.trim().length > 0 ||
        set.durationSeconds != null ||
        set.rpe != null
    );
  }, [activeExercise]);

  const selectionInFlightRef = useRef(false);

  const runExclusiveSelection = useCallback(
    async (action: () => Promise<void>) => {
      if (selectionInFlightRef.current) return;
      selectionInFlightRef.current = true;
      try {
        await action();
      } finally {
        selectionInFlightRef.current = false;
      }
    },
    []
  );

  const getPreviousDisplays = useCallback(
    async (exercise: Exercise): Promise<ExercisePreviousSets | undefined> => {
      const previousSets: Record<string, ExercisePreviousSets> =
        await fetchPreviousSetDisplays([exercise.id], weightUnit).catch(
          (error) => {
            console.warn(
              "[exercise-picker] failed to fetch previous set displays",
              error
            );
            return {};
          }
        );

      return previousSets[exercise.id];
    },
    [weightUnit]
  );

  const replaceCurrentExercise = useCallback(
    async (exercise: Exercise) => {
      if (!exerciseId) return;
      await runExclusiveSelection(async () => {
        const previous = await getPreviousDisplays(exercise);
        replaceExercise(
          occurrenceId ?? exerciseId,
          {
            id: exercise.id,
            name: exercise.name,
            image: exercise.image,
            exerciseType: exercise.exercise_type,
          },
          previous
        );
        router.back();
      });
    },
    [
      exerciseId,
      getPreviousDisplays,
      occurrenceId,
      replaceExercise,
      router,
      runExclusiveSelection,
    ]
  );

  const addBelowCurrentExercise = useCallback(
    async (exercise: Exercise) => {
      if (!exerciseId) return;
      await runExclusiveSelection(async () => {
        const previous = await getPreviousDisplays(exercise);
        addExerciseAfter(exerciseId, {
          id: exercise.id,
          name: exercise.name,
          image: exercise.image,
          exerciseType: exercise.exercise_type,
          previous,
        });
        router.back();
      });
    },
    [
      addExerciseAfter,
      exerciseId,
      getPreviousDisplays,
      router,
      runExclusiveSelection,
    ]
  );

  const handleSelect = useCallback(
    async (exercise: Exercise) => {
      if (mode === "pending_swap") {
        if (selectionInFlightRef.current) return;
        setSwapResult({
          id: exercise.id,
          name: exercise.name,
          image: exercise.image,
          exerciseType: exercise.exercise_type,
        });
        router.back();
        return;
      }
      if (mode === "add") {
        await runExclusiveSelection(async () => {
          const previous = await getPreviousDisplays(exercise);
          addExercise({
            id: exercise.id,
            name: exercise.name,
            image: exercise.image,
            exerciseType: exercise.exercise_type,
            previous,
          });
          router.back();
        });
        return;
      }
      if (exerciseId) {
        if (hasLoggedValues()) {
          Alert.alert(t("replaceConfirm.title"), t("replaceConfirm.message"), [
            {
              text: t("replaceConfirm.override"),
              style: "destructive",
              onPress: () => {
                void replaceCurrentExercise(exercise);
              },
            },
            {
              text: t("replaceConfirm.addBelow"),
              onPress: () => {
                void addBelowCurrentExercise(exercise);
              },
            },
          ]);
          return;
        }
        await replaceCurrentExercise(exercise);
        return;
      }
      router.back();
    },
    [
      mode,
      exerciseId,
      addExercise,
      addBelowCurrentExercise,
      getPreviousDisplays,
      hasLoggedValues,
      replaceCurrentExercise,
      router,
      runExclusiveSelection,
      setSwapResult,
      t,
    ]
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
      <ExerciseRow
        exercise={item}
        onSelect={handleSelect}
        mode={mode}
        isFavorite={preferredIds.has(item.id)}
      />
    ),
    [handleSelect, mode, preferredIds]
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
    if (favoritesOnly && preferredIds.size === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={[Typography.titleSm, { color: textColor }]}>
            {t("list.emptyFavorites")}
          </Text>
          <Text
            style={[Typography.body, styles.emptyHint, { color: textMuted }]}
          >
            {t("list.emptyFavoritesHint")}
          </Text>
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
  }, [
    favoritesOnly,
    isLoading,
    preferredIds.size,
    primary,
    textColor,
    textMuted,
    t,
  ]);

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
            onClear={handleClearSearch}
            placeholder={t("search.placeholder")}
            clearAccessibilityLabel={t("search.clear")}
          />

          {/* Filter Pills */}
          <FilterPills
            favoritesOnly={favoritesOnly}
            selectedMuscles={selectedMuscles}
            selectedEquipment={selectedEquipment}
            onPressFavorites={() => setFavoritesOnly((prev) => !prev)}
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
            title={t("filters.muscleSheetTitle")}
            closeAccessibilityLabel={t("filters.closeSheet")}
            loadingLabel={t("filters.loadingOptions")}
            isLoading={isFilterOptionsLoading}
            options={filterOptions.muscles}
            selected={selectedMuscles}
            displayLabels={labelMaps.muscle}
            onToggle={toggleMuscle}
          />
          <FilterSheet
            visible={equipmentSheetVisible}
            onClose={() => setEquipmentSheetVisible(false)}
            title={t("filters.equipmentSheetTitle")}
            closeAccessibilityLabel={t("filters.closeSheet")}
            loadingLabel={t("filters.loadingOptions")}
            isLoading={isFilterOptionsLoading}
            options={filterOptions.equipment}
            selected={selectedEquipment}
            displayLabels={labelMaps.equipment}
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
    paddingHorizontal: Spacing["3xl"],
    gap: Spacing.sm,
  },
  emptyHint: {
    textAlign: "center",
  },
});

function getPreferredExerciseIds(
  preferencesMap: Map<string, ExercisePreferenceValue> | undefined
): Set<string> {
  const ids = new Set<string>();
  if (!preferencesMap) return ids;
  for (const [id, preference] of preferencesMap) {
    if (preference === EXERCISE_PREFERENCE.PREFERRED) {
      ids.add(id);
    }
  }
  return ids;
}
