/**
 * Pure helpers for deciding when a logged set beats a personal record.
 *
 * A set can set two kinds of record during a live session:
 *  - `weight`: the heaviest load ever lifted on the exercise
 *  - `reps`:   the most reps ever performed on the exercise
 *
 * Records are evaluated against an all-time baseline (synced from the server,
 * reflecting *saved* history only) combined with the best completed set logged
 * so far in the current session. Combining the two prevents a single PR from
 * re-firing on every subsequent equal/lighter set in the same exercise: only
 * the unique top set is flagged.
 */

const EPSILON = 1e-3;

export interface RecordBaseline {
  /** Heaviest load (kg) ever lifted on this exercise. 0 when no history. */
  maxWeightKg: number;
  /** Most reps ever performed on this exercise. 0 when no history. */
  maxReps: number;
}

export interface SetRecordInput {
  id: string;
  /** Load in kg, or null when blank / unparseable. */
  weightKg: number | null;
  /** Reps, or null when blank / unparseable. */
  reps: number | null;
  isCompleted: boolean;
  /** Warmup sets never count toward records. */
  isWorking: boolean;
}

export interface SetRecordStatus {
  isWeightRecord: boolean;
  isRepsRecord: boolean;
}

export const EMPTY_RECORD_STATUS: SetRecordStatus = {
  isWeightRecord: false,
  isRepsRecord: false,
};

export function isRecordStatus(status: SetRecordStatus): boolean {
  return status.isWeightRecord || status.isRepsRecord;
}

/**
 * Parse a free-text numeric field (the store keeps `kg`/`reps` as strings in
 * the user's display unit). Returns null for blank or non-finite input.
 */
export function parseNumericField(
  value: string | null | undefined
): number | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Evaluate the record status of every set for one exercise.
 *
 * For each completed working set we compare it against the baseline plus every
 * *other* completed working set. A set is a record only when it is strictly the
 * single best — ties never both light up, avoiding double celebrations.
 */
export function evaluateExerciseRecords(
  sets: SetRecordInput[],
  baseline: RecordBaseline
): Map<string, SetRecordStatus> {
  const result = new Map<string, SetRecordStatus>();

  const eligible = sets.filter((s) => s.isWorking && s.isCompleted);

  for (const set of sets) {
    if (!set.isWorking || !set.isCompleted) {
      result.set(set.id, EMPTY_RECORD_STATUS);
      continue;
    }

    let isWeightRecord = false;
    if (set.weightKg != null && set.weightKg > 0) {
      let benchmark = baseline.maxWeightKg;
      for (const other of eligible) {
        if (other.id === set.id) continue;
        if (other.weightKg != null) {
          benchmark = Math.max(benchmark, other.weightKg);
        }
      }
      isWeightRecord = set.weightKg > benchmark + EPSILON;
    }

    let isRepsRecord = false;
    if (set.reps != null && set.reps > 0) {
      let benchmark = baseline.maxReps;
      for (const other of eligible) {
        if (other.id === set.id) continue;
        if (other.reps != null) {
          benchmark = Math.max(benchmark, other.reps);
        }
      }
      isRepsRecord = set.reps > benchmark + EPSILON;
    }

    result.set(set.id, { isWeightRecord, isRepsRecord });
  }

  return result;
}
