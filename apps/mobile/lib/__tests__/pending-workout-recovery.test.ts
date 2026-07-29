import type {
  PendingWorkout,
  PendingWorkoutStatus,
} from "@/lib/api/pending-workouts";
import {
  getPendingWorkoutRecoveryAction,
  isPendingWorkoutStale,
  MAX_PENDING_WORKOUT_RECOVERY_ATTEMPTS,
  STALE_PENDING_WORKOUT_MS,
} from "@/lib/pending-workout-recovery";

const NOW = new Date("2026-07-29T12:00:00.000Z").getTime();

function createPendingWorkout(
  status: PendingWorkoutStatus,
  ageMs = 0
): PendingWorkout {
  const timestamp = new Date(NOW - ageMs).toISOString();

  return {
    id: "11111111-1111-1111-1111-111111111111",
    user_id: "22222222-2222-2222-2222-222222222222",
    queue_position: 1,
    status,
    workout_data: null,
    generation_source: null,
    focus_area: "full_body",
    generated_at: null,
    last_regenerated_at: null,
    regeneration_count: 0,
    regeneration_feedback: [],
    user_edits: null,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

describe("activation recovery state matrix", () => {
  it.each([
    ["ready", 0, "ready"],
    ["queued", 0, "wait"],
    ["generating", 0, "wait"],
    ["regenerating", 0, "wait"],
  ] as const)(
    "maps a fresh %s workout with %i attempts to %s",
    (status, attempts, expected) => {
      expect(
        getPendingWorkoutRecoveryAction(
          createPendingWorkout(status),
          attempts,
          NOW
        )
      ).toBe(expected);
    }
  );

  it.each(["queued", "generating", "regenerating"] as const)(
    "offers retry when %s generation becomes stale",
    (status) => {
      const workout = createPendingWorkout(
        status,
        STALE_PENDING_WORKOUT_MS + 1
      );

      expect(isPendingWorkoutStale(workout, NOW)).toBe(true);
      expect(getPendingWorkoutRecoveryAction(workout, 0, NOW)).toBe("retry");
    }
  );

  it("offers retry immediately for an explicit generation failure", () => {
    const workout = createPendingWorkout("failed");

    expect(isPendingWorkoutStale(workout, NOW)).toBe(true);
    expect(getPendingWorkoutRecoveryAction(workout, 0, NOW)).toBe("retry");
  });

  it.each(["queued", "generating", "regenerating", "failed"] as const)(
    "requires an explicit fallback after bounded retries for %s",
    (status) => {
      const workout = createPendingWorkout(
        status,
        STALE_PENDING_WORKOUT_MS + 1
      );

      expect(
        getPendingWorkoutRecoveryAction(
          workout,
          MAX_PENDING_WORKOUT_RECOVERY_ATTEMPTS,
          NOW
        )
      ).toBe("fallback");
    }
  );

  it("never routes a ready workout backward, even with persisted attempts", () => {
    expect(
      getPendingWorkoutRecoveryAction(
        createPendingWorkout("ready"),
        MAX_PENDING_WORKOUT_RECOVERY_ATTEMPTS,
        NOW
      )
    ).toBe("ready");
  });
});
