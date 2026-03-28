import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { exerciseMuscleKeys } from "@/lib/query-keys";
import { getMuscleDisplayName } from "@/lib/workout-summary-utils";

interface ExerciseMusclesPayload {
  muscles: string[];
  primaryMusclesByExerciseId: Record<string, string[]>;
}

async function fetchExerciseMuscles(
  exerciseIds: string[]
): Promise<ExerciseMusclesPayload> {
  if (exerciseIds.length === 0) {
    return { muscles: [], primaryMusclesByExerciseId: {} };
  }

  const { data, error } = await supabase
    .from("exercises")
    .select("id, primary_muscles")
    .in("id", exerciseIds);

  if (error || !data) {
    return { muscles: [], primaryMusclesByExerciseId: {} };
  }

  const primaryMusclesByExerciseId: Record<string, string[]> = {};
  const allMuscles: string[] = [];

  for (const row of data) {
    const slugs = Array.isArray(row.primary_muscles)
      ? (row.primary_muscles as string[])
      : [];
    primaryMusclesByExerciseId[row.id] = slugs;
    allMuscles.push(...slugs);
  }

  const seen = new Set<string>();
  const muscles: string[] = [];

  for (const muscle of allMuscles) {
    const displayName = getMuscleDisplayName(muscle);
    if (!seen.has(displayName)) {
      seen.add(displayName);
      muscles.push(displayName);
    }
  }

  return { muscles, primaryMusclesByExerciseId };
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
    muscles: data?.muscles ?? [],
    primaryMusclesByExerciseId: data?.primaryMusclesByExerciseId ?? {},
    isLoading,
  };
}
