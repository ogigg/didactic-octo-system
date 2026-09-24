import { useQuery } from "@tanstack/react-query";
import type { UseQueryOptions } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { ExerciseFilters, Exercise } from "@/lib/api/exercises";
import {
  fetchCatalogLabels,
  fetchExerciseFilterOptions,
  fetchExercise,
  fetchExercises,
} from "@/lib/api/exercises";
import { normalizeLanguage } from "@/i18n";
import { exerciseKeys } from "@/lib/query-keys";

export function useAppCatalogLanguage() {
  const { i18n } = useTranslation();

  return normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
}

export function useExercises(
  filters?: ExerciseFilters,
  options?: Omit<UseQueryOptions<Exercise[], Error>, "queryKey" | "queryFn">
) {
  const language = useAppCatalogLanguage();

  return useQuery({
    queryKey: exerciseKeys.list(filters, language),
    queryFn: () => fetchExercises(filters, language),
    ...options,
  });
}

export function useExercise(id: string) {
  const language = useAppCatalogLanguage();

  return useQuery({
    queryKey: exerciseKeys.detail(id, language),
    queryFn: () => fetchExercise(id, language),
    enabled: !!id,
  });
}

export function useLocalizedExercises(ids: string[]) {
  const language = useAppCatalogLanguage();
  const sortedIds = useMemo(() => [...new Set(ids)].sort(), [ids]);

  return useQuery({
    queryKey: exerciseKeys.list({ ids: sortedIds }, language),
    queryFn: () => fetchExercises({ ids: sortedIds }, language),
    enabled: sortedIds.length > 0,
    staleTime: 60_000,
  });
}

export function useLocalizedExerciseMap(ids: string[]) {
  const result = useLocalizedExercises(ids);
  const exerciseMap = useMemo(
    () =>
      new Map((result.data ?? []).map((exercise) => [exercise.id, exercise])),
    [result.data]
  );

  return {
    ...result,
    exerciseMap,
  };
}

export function useCatalogLabels() {
  const language = useAppCatalogLanguage();

  const result = useQuery({
    queryKey: exerciseKeys.labels(language),
    queryFn: () => fetchCatalogLabels(language),
    staleTime: 60_000,
  });

  const labelMaps = useMemo(() => {
    const maps = {
      muscle: new Map<string, string>(),
      equipment: new Map<string, string>(),
      difficulty: new Map<string, string>(),
    };

    for (const label of result.data ?? []) {
      maps[label.label_type].set(label.label_key, label.display_name);
    }

    return maps;
  }, [result.data]);

  return {
    ...result,
    labelMaps,
  };
}

export function useExerciseFilterOptions() {
  const language = useAppCatalogLanguage();

  const result = useQuery({
    queryKey: exerciseKeys.filterOptions(language),
    queryFn: async () => {
      try {
        const options = await fetchExerciseFilterOptions(language);
        if (options.length > 0) return options;
        console.warn(
          "[exercises] filter options RPC returned no rows, falling back to catalog labels"
        );
      } catch (error) {
        console.warn(
          "[exercises] filter options RPC failed, falling back to catalog labels:",
          error
        );
      }
      // Keep fallback options aligned with the exercises users can actually
      // select. Catalog labels also contain retired and secondary-only values.
      return deriveFilterOptionsFromExercises(
        await fetchExercises(undefined, language)
      );
    },
    staleTime: 60_000,
  });

  const filterOptions = useMemo(() => {
    const options = {
      muscles: [] as string[],
      equipment: [] as string[],
    };
    const labelMaps = {
      muscle: new Map<string, string>(),
      equipment: new Map<string, string>(),
    };

    for (const option of result.data ?? []) {
      if (option.label_type === "muscle") {
        options.muscles.push(option.label_key);
        labelMaps.muscle.set(option.label_key, option.display_name);
      }

      if (option.label_type === "equipment") {
        options.equipment.push(option.label_key);
        labelMaps.equipment.set(option.label_key, option.display_name);
      }
    }

    return { options, labelMaps };
  }, [result.data]);

  return {
    ...result,
    filterOptions: filterOptions.options,
    labelMaps: filterOptions.labelMaps,
  };
}

function deriveFilterOptionsFromExercises(exercises: Exercise[]) {
  const muscles = new Map<string, string>();
  const equipment = new Map<string, string>();

  for (const exercise of exercises) {
    exercise.primary_muscles.forEach((key, index) => {
      muscles.set(key, exercise.primary_muscle_labels[index] ?? key);
    });
    exercise.equipment.forEach((key, index) => {
      equipment.set(key, exercise.equipment_labels[index] ?? key);
    });
  }

  return [
    ...[...muscles].map(([label_key, display_name]) => ({
      label_type: "muscle" as const,
      label_key,
      display_name,
    })),
    ...[...equipment].map(([label_key, display_name]) => ({
      label_type: "equipment" as const,
      label_key,
      display_name,
    })),
  ].sort((a, b) => a.display_name.localeCompare(b.display_name));
}
