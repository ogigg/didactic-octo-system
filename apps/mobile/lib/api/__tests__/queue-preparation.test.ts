jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    functions: { invoke: jest.fn() },
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));
import { supabase } from "@/lib/supabase";
import {
  triggerQueueGeneration,
  triggerRegeneration,
  fetchPendingWorkouts,
  GenerationLimitReachedError,
  WorkoutGenerationError,
  type QueueGenerationRequest,
} from "../pending-workouts";
const request: QueueGenerationRequest = {
  count: 3,
  trigger: "onboarding",
  baselines: [],
  preferences: {
    training_split: "full_body",
    session_duration_minutes: 30,
    equipment: "bodyweight",
    training_style: "strength",
    difficulty: "beginner",
  },
};
beforeEach(() => jest.clearAllMocks());
it("does not delete saved workouts when the function cannot be reached", async () => {
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({
    data: null,
    error: { message: "Network request failed" },
  });
  await expect(triggerQueueGeneration(request)).rejects.toThrow(
    "Network request failed"
  );
  expect(supabase.from).not.toHaveBeenCalled();
});
it("does not treat an incomplete response as success", async () => {
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({
    data: { success: false },
    error: null,
  });
  await expect(triggerQueueGeneration(request)).rejects.toThrow(
    "did not complete"
  );
});
it("reads structured allowance failures from the function response", async () => {
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({
    data: null,
    error: {
      message: "non-2xx",
      context: {
        json: async () => ({
          error: "generation_limit_reached",
          used: 5,
          remaining: 0,
          tier: "free",
        }),
      },
    },
  });
  await expect(triggerQueueGeneration(request)).rejects.toBeInstanceOf(
    GenerationLimitReachedError
  );
});

it("keeps structured regeneration errors from a JSON response body", async () => {
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({
    data: null,
    error: {
      message: "Edge Function returned a non-2xx status code",
      context: {
        json: async () =>
          JSON.stringify({
            error: "A generation is already in progress.",
            error_code: "generation_in_progress",
            request_id: "33333333-3333-3333-3333-333333333333",
            retryable: true,
          }),
      },
    },
  });

  const promise = triggerRegeneration(
    "11111111-1111-1111-1111-111111111111",
    request.preferences,
    0
  );
  await expect(promise).rejects.toMatchObject({
    message: "A generation is already in progress.",
    error_code: "generation_in_progress",
    request_id: "33333333-3333-3333-3333-333333333333",
    retryable: true,
  });
  await expect(promise).rejects.toBeInstanceOf(WorkoutGenerationError);
});

it("uses the client request ID when a regeneration error has no server body", async () => {
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({
    data: null,
    error: { message: "Network request failed" },
  });

  await expect(
    triggerRegeneration(
      "11111111-1111-1111-1111-111111111111",
      request.preferences,
      0,
      undefined,
      "44444444-4444-4444-4444-444444444444"
    )
  ).rejects.toMatchObject({
    request_id: "44444444-4444-4444-4444-444444444444",
    message: "Network request failed",
  });
});

it("turns an invalid regeneration success payload into a typed error", async () => {
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({
    data: { unexpected: true },
    error: null,
  });

  await expect(
    triggerRegeneration(
      "11111111-1111-1111-1111-111111111111",
      request.preferences,
      0,
      undefined,
      "55555555-5555-5555-5555-555555555555"
    )
  ).rejects.toMatchObject({
    error_code: "invalid_response",
    request_id: "55555555-5555-5555-5555-555555555555",
  });
});

it("recovers stale queue rows and refetches the authoritative queue", async () => {
  const userId = "22222222-2222-2222-2222-222222222222";
  const staleWorkout = {
    id: "11111111-1111-1111-1111-111111111111",
    user_id: userId,
    queue_position: 1,
    status: "regenerating",
    workout_data: null,
    generation_source: null,
    focus_area: "full_body",
    generated_at: null,
    last_regenerated_at: null,
    regeneration_count: 0,
    regeneration_feedback: [],
    user_edits: null,
    created_at: "2026-04-05T08:00:00.000Z",
    updated_at: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
  };
  const recoveredWorkout = { ...staleWorkout, status: "failed" };
  const order = jest
    .fn()
    .mockResolvedValueOnce({ data: [staleWorkout], error: null })
    .mockResolvedValueOnce({ data: [recoveredWorkout], error: null });
  const select = jest.fn().mockReturnValue({ order });
  (supabase.from as jest.Mock).mockReturnValue({ select });
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({
    data: { user: { id: userId } },
    error: null,
  });
  (supabase.rpc as jest.Mock).mockResolvedValue({ data: 1, error: null });

  await expect(fetchPendingWorkouts()).resolves.toEqual([recoveredWorkout]);
  expect(supabase.rpc).toHaveBeenCalledWith(
    "recover_stale_generation_attempts",
    { p_user_id: userId }
  );
  expect(order).toHaveBeenCalledTimes(2);
});
