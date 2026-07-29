jest.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

import { supabase } from "@/lib/supabase";
import {
  parsePendingWorkoutRows,
  replacePendingWorkoutWithFallback,
} from "@/lib/api/pending-workouts";

const FALLBACK_WORKOUT = {
  workout_name: "Plan awaryjny",
  warmup: null,
  generation_source: "fallback_template" as const,
  goal_snapshot: "improve_fitness" as const,
  custom_goal_snapshot: null,
  exercises: [],
};

describe("pending workout fallback replacement", () => {
  it("uses the expected generation version for atomic replacement", async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({
      data: true,
      error: null,
    });

    await replacePendingWorkoutWithFallback(
      "11111111-1111-1111-1111-111111111111",
      4,
      FALLBACK_WORKOUT
    );

    expect(supabase.rpc).toHaveBeenCalledWith(
      "replace_pending_workout_with_fallback",
      {
        p_pending_workout_id: "11111111-1111-1111-1111-111111111111",
        p_expected_version: 4,
        p_workout_data: FALLBACK_WORKOUT,
      }
    );
  });

  it("surfaces a concurrent replacement failure", async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({
      data: false,
      error: null,
    });

    await expect(
      replacePendingWorkoutWithFallback(
        "11111111-1111-1111-1111-111111111111",
        4,
        FALLBACK_WORKOUT
      )
    ).rejects.toThrow("changed before fallback was applied");
  });
});

describe("pending workout response parsing", () => {
  it("marks ready rows with invalid workout data as corrupt and recoverable", () => {
    const [workout] = parsePendingWorkoutRows([
      {
        id: "11111111-1111-1111-1111-111111111111",
        user_id: "22222222-2222-2222-2222-222222222222",
        queue_position: 1,
        status: "ready",
        workout_data: { exercises: "invalid" },
        generation_source: "llm",
        focus_area: "full_body",
        generated_at: "2026-07-29T10:00:00.000Z",
        last_regenerated_at: null,
        regeneration_count: 0,
        regeneration_feedback: [],
        user_edits: null,
        generation_version: 3,
        created_at: "2026-07-29T09:00:00.000Z",
        updated_at: "2026-07-29T10:00:00.000Z",
      },
    ]);

    expect(workout.status).toBe("ready");
    expect(workout.workout_data).toBeNull();
    expect(workout.workout_data_corrupt).toBe(true);
  });
});
