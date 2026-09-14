jest.mock("@/lib/supabase", () => ({
  supabase: { functions: { invoke: jest.fn() }, from: jest.fn() },
}));
import { supabase } from "@/lib/supabase";
import {
  triggerQueueGeneration,
  GenerationLimitReachedError,
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
