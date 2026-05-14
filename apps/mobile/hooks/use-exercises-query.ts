import { useQuery } from "@tanstack/react-query";
import type { UseQueryOptions } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { ExerciseFilters, Exercise } from "@/lib/api/exercises";
import {
  fetchCatalogLabels,
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
