import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { exerciseMuscleKeys } from "@/lib/query-keys";
import { getMuscleDisplayName } from "@/lib/workout-summary-utils";

async function fetchExerciseMuscles(exerciseIds: string[]): Promise<string[]> {
  if (exerciseIds.length === 0) return [];

  const { data, error } = await supabase
    .from("exercises")
    .select("id, primary_muscles")
    .in("id", exerciseIds);

  if (error || !data) return [];

  const allMuscles = data.flatMap((row) =>
    Array.isArray(row.primary_muscles) ? (row.primary_muscles as string[]) : []
  );

  // Map to display names and deduplicate
  const seen = new Set<string>();
  const result: string[] = [];

  for (const muscle of allMuscles) {
    const displayName = getMuscleDisplayName(muscle);
    if (!seen.has(displayName)) {
      seen.add(displayName);
      result.push(displayName);
    }
  }

  return result;
}

export function useExerciseMuscles(exerciseIds: string[]) {
  const sortedIds = [...exerciseIds].sort();

  const { data, isLoading } = useQuery({
    queryKey: exerciseMuscleKeys.byIds(sortedIds),
    queryFn: () => fetchExerciseMuscles(sortedIds),
    enabled: sortedIds.length > 0,
    staleTime: Infinity,
  });

  return {
    muscles: data ?? [],
    isLoading,
  };
}
