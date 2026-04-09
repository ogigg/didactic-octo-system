import type { WorkoutExercise, WorkoutSet } from "@/stores/workout-store";

// ---------------------------------------------------------------------------
// Volume computation
// ---------------------------------------------------------------------------

export function computeTotalVolume(exercises: WorkoutExercise[]): number {
  let total = 0;
  for (const exercise of exercises) {
    for (const set of exercise.sets) {
      if (!set.isCompleted) continue;
      const kg = parseFloat(set.kg);
      const reps = parseFloat(set.reps);
      if (!isNaN(kg) && !isNaN(reps)) {
        total += kg * reps;
      }
    }
  }
  return Math.round(total);
}

// ---------------------------------------------------------------------------
// Session stats
// ---------------------------------------------------------------------------

export interface SessionStats {
  exerciseCount: number;
  totalSets: number;
  completedSets: number;
  completionRate: number;
}

export function computeSessionStats(
  exercises: WorkoutExercise[]
): SessionStats {
  let totalSets = 0;
  let completedSets = 0;

  for (const exercise of exercises) {
    for (const set of exercise.sets) {
      totalSets++;
      if (set.isCompleted) completedSets++;
    }
  }

  return {
    exerciseCount: exercises.length,
    totalSets,
    completedSets,
    completionRate:
      totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0,
  };
}

// ---------------------------------------------------------------------------
// Volume comparison
// ---------------------------------------------------------------------------

export interface VolumeComparison {
  /** i18n key within summary.volume namespace */
  key: string;
}

export function getVolumeComparison(totalKg: number): VolumeComparison {
  if (totalKg === 0) return { key: "summary.volume.bodyweight" };
  if (totalKg < 100) return { key: "summary.volume.textbooks" };
  if (totalKg < 500) return { key: "summary.volume.piano" };
  if (totalKg < 1000) return { key: "summary.volume.horse" };
  if (totalKg < 2000) return { key: "summary.volume.car" };
  if (totalKg < 5000) return { key: "summary.volume.elephant" };
  if (totalKg < 10000) return { key: "summary.volume.bus" };
  return { key: "summary.volume.whale" };
}

// ---------------------------------------------------------------------------
// Muscle display name mapping
// ---------------------------------------------------------------------------

const MUSCLE_DISPLAY_NAMES: Record<string, string> = {
  "Anterior deltoid": "Front Delts",
  "Biceps brachii": "Biceps",
  Brachialis: "Forearms",
  "Erector spinae": "Lower Back",
  Gastrocnemius: "Calves",
  "Gluteus maximus": "Glutes",
  Hamstrings: "Hamstrings",
  "Lateral deltoid": "Side Delts",
  "Latissimus dorsi": "Back",
  "Pectoralis major": "Chest",
  "Posterior deltoid": "Rear Delts",
  Quadriceps: "Quads",
  "Rectus abdominis": "Abs",
  Rhomboids: "Upper Back",
  Soleus: "Calves",
  "Triceps brachii": "Triceps",
};

export function getMuscleDisplayName(rawMuscle: string): string {
  return MUSCLE_DISPLAY_NAMES[rawMuscle] ?? rawMuscle;
}

// ---------------------------------------------------------------------------
// Top set
// ---------------------------------------------------------------------------

export interface TopSet {
  kg: number;
  reps: number;
}

export function getTopSet(sets: WorkoutSet[]): TopSet | null {
  let best: TopSet | null = null;
  let bestScore = -1;

  for (const set of sets) {
    if (!set.isCompleted) continue;
    const kg = parseFloat(set.kg);
    const reps = parseFloat(set.reps);
    if (isNaN(kg) || isNaN(reps)) continue;
    const score = kg * reps;
    if (score > bestScore) {
      bestScore = score;
      best = { kg, reps };
    }
  }

  return best;
}

export function getBestDurationSeconds(sets: WorkoutSet[]): number | null {
  let best: number | null = null;
  for (const set of sets) {
    if (!set.isCompleted) continue;
    const dur = set.durationSeconds;
    if (dur == null || dur <= 0) continue;
    if (best === null || dur > best) best = dur;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Duration formatting
// ---------------------------------------------------------------------------

export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}
