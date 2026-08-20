jest.mock("@/lib/api/exercises", () => ({
  fetchExercises: jest.fn(),
}));

import { fetchExercises } from "@/lib/api/exercises";
import type {
  PendingWorkout,
  PendingWorkoutStatus,
} from "@/lib/api/pending-workouts";
import {
  buildFallbackPendingWorkoutData,
  buildPendingWorkoutSupportReference,
  getPendingWorkoutRecoveryAction,
  getRecoveryTiming,
  isPendingWorkoutStale,
  MAX_PENDING_WORKOUT_RECOVERY_ATTEMPTS,
  STALE_PENDING_WORKOUT_MS,
  shouldTrackRecoveryExposure,
} from "@/lib/pending-workout-recovery";

const NOW = new Date("2026-07-29T12:00:00.000Z").getTime();
const VALID_WORKOUT = {
  workout_name: "Ready workout",
  warmup: null,
  generation_source: "llm" as const,
  goal_snapshot: "improve_fitness" as const,
  custom_goal_snapshot: null,
  exercises: [],
};

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
    workout_data: status === "ready" ? VALID_WORKOUT : null,
    generation_source: null,
    focus_area: "full_body",
    generated_at: null,
    last_regenerated_at: null,
    regeneration_count: 0,
    regeneration_feedback: [],
    user_edits: null,
    generation_version: 0,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

describe("activation recovery state matrix", () => {
  it("scopes support references to the owning account", () => {
    const workoutId = "11111111-1111-1111-1111-111111111111";

    expect(
      buildPendingWorkoutSupportReference(
        "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        workoutId
      )
    ).not.toBe(
      buildPendingWorkoutSupportReference(
        "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        workoutId
      )
    );
  });

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

  it("treats ready with null workout data as corrupt and recoverable", () => {
    const workout = {
      ...createPendingWorkout("ready"),
      workout_data: null,
      workout_data_corrupt: true,
    };

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

  it("deduplicates stable exposure while tracking retry to fallback", () => {
    expect(shouldTrackRecoveryExposure(undefined, "retry")).toBe(true);
    expect(shouldTrackRecoveryExposure("retry", "retry")).toBe(false);
    expect(shouldTrackRecoveryExposure("retry", "fallback")).toBe(true);
  });

  it("records non-negative return-to-ready timing", () => {
    expect(getRecoveryTiming(1_000, 1_750)).toEqual({
      returnedToReadyAt: 1_750,
      returnToReadyMs: 750,
    });
    expect(getRecoveryTiming(2_000, 1_750).returnToReadyMs).toBe(0);
  });

  it("builds fallback copy supplied by the active Polish locale", async () => {
    (fetchExercises as jest.Mock).mockResolvedValue(
      ["Przysiad", "Wyciskanie", "Wiosłowanie"].map((name, index) => ({
        id: `${index + 1}1111111-1111-1111-1111-111111111111`,
        name:
          index === 0
            ? `Squat ${name}`
            : index === 1
              ? `Bench Press ${name}`
              : `Row ${name}`,
        exercise_type: "weight",
        primary_muscles: ["mięśnie"],
        image: null,
      }))
    );

    const fallback = await buildFallbackPendingWorkoutData({
      focusArea: "full_body",
      equipment: "full_gym",
      goalSnapshot: "improve_fitness",
      customGoalSnapshot: null,
      copy: {
        workoutName: () => "Plan awaryjny: całe ciało",
        muscleGroups: () => "Ciągłość planu",
        trainingStrategy: "Zachowawcze cele",
        notes: "Szablon awaryjny",
        exerciseMuscles: (name) => `Ćwiczenie ${name}`,
        exerciseSelection: "Niezawodna opcja",
      },
    });

    expect(fallback?.workout_name).toBe("Plan awaryjny: całe ciało");
    expect(fallback?.reasoning?.training_strategy).toBe("Zachowawcze cele");
    expect(fallback?.exercises[0].notes).toBe("Szablon awaryjny");
  });
});
