jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

import {
  getCurrentTimezoneOffsetMinutes,
  getPendingWorkoutRegenerationEligibility,
  wasPendingWorkoutRegeneratedToday,
} from "../pending-workout-regeneration";
import {
  selectIsFullyReady,
  selectNextWorkout,
  selectReadyCount,
} from "../../stores/pending-workout-store";
import type { PendingWorkout } from "../api/pending-workouts";

function createPendingWorkout(
  overrides: Partial<PendingWorkout> = {}
): PendingWorkout {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    user_id: "22222222-2222-2222-2222-222222222222",
    queue_position: 1,
    status: "ready",
    workout_data: null,
    generation_source: null,
    focus_area: "full_body",
    generated_at: null,
    last_regenerated_at: null,
    regeneration_count: 0,
    regeneration_feedback: [],
    user_edits: null,
    created_at: "2026-04-05T08:00:00.000Z",
    updated_at: "2026-04-05T08:00:00.000Z",
    ...overrides,
  };
}

describe("pending workout regeneration helpers", () => {
  it("allows regeneration when the plan has never been regenerated", () => {
    const eligibility = getPendingWorkoutRegenerationEligibility(
      null,
      new Date("2026-04-06T09:00:00.000Z")
    );

    expect(eligibility.canRegenerate).toBe(true);
    expect(eligibility.wasRegeneratedToday).toBe(false);
    expect(eligibility.timezoneOffsetMinutes).toBe(
      getCurrentTimezoneOffsetMinutes(new Date("2026-04-06T09:00:00.000Z"))
    );
  });

  it("blocks regeneration when the plan was regenerated earlier on the same local day", () => {
    const now = new Date("2026-04-06T18:00:00.000Z");

    expect(
      wasPendingWorkoutRegeneratedToday("2026-04-06T08:30:00.000Z", now)
    ).toBe(true);

    const eligibility = getPendingWorkoutRegenerationEligibility(
      "2026-04-06T08:30:00.000Z",
      now
    );

    expect(eligibility.canRegenerate).toBe(false);
    expect(eligibility.wasRegeneratedToday).toBe(true);
  });

  it("allows regeneration again on the next local day", () => {
    const eligibility = getPendingWorkoutRegenerationEligibility(
      "2026-04-04T23:30:00.000Z",
      new Date("2026-04-06T09:00:00.000Z")
    );

    expect(eligibility.canRegenerate).toBe(true);
    expect(eligibility.wasRegeneratedToday).toBe(false);
  });
});

describe("pending workout selectors", () => {
  it("skips regenerating workouts when selecting the next ready plan", () => {
    const queue = [
      createPendingWorkout({
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        status: "regenerating",
      }),
      createPendingWorkout({
        id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        queue_position: 2,
        status: "ready",
      }),
    ];

    expect(selectNextWorkout(queue)?.id).toBe(
      "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
    );
  });

  it("excludes regenerating workouts from the ready count and fully-ready state", () => {
    const queue = [
      createPendingWorkout({
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        status: "ready",
      }),
      createPendingWorkout({
        id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        queue_position: 2,
        status: "regenerating",
      }),
    ];

    expect(selectReadyCount(queue)).toBe(1);
    expect(selectIsFullyReady(queue)).toBe(false);
  });
});
