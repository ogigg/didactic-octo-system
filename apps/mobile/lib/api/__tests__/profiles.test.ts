jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

import { supabase } from "@/lib/supabase";
import { mapOnboardingToProfile, upsertProfile } from "../profiles";
import type { Frequency } from "@/stores/onboarding-store";

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

const baseOnboardingData = {
  equipment: "full_gym" as const,
  experience: "intermediate" as const,
  strengthBaselines: [],
};

describe("mapOnboardingToProfile", () => {
  it("maps standard goal and gender", () => {
    const result = mapOnboardingToProfile({
      gender: "male",
      goal: "build_strength",
      customGoal: null,
      frequency: 3,
      ...baseOnboardingData,
    });

    expect(result).toMatchObject({
      gender: "male",
      goal: "build_strength",
      custom_goal: null,
      weekly_frequency: "3",
      onboarding_completed: true,
    });
  });

  it("maps gender 'other' to 'prefer_not_to_say'", () => {
    const result = mapOnboardingToProfile({
      gender: "other",
      goal: "lose_weight",
      customGoal: null,
      frequency: 2,
      ...baseOnboardingData,
    });

    expect(result.gender).toBe("prefer_not_to_say");
  });

  it("maps null gender (skipped) to null", () => {
    const result = mapOnboardingToProfile({
      gender: null,
      goal: "improve_fitness",
      customGoal: null,
      frequency: 4,
      ...baseOnboardingData,
    });

    expect(result.gender).toBeNull();
  });

  it("maps frequency 5 to '5_plus'", () => {
    const result = mapOnboardingToProfile({
      gender: "female",
      goal: "build_strength",
      customGoal: null,
      frequency: 5,
      ...baseOnboardingData,
    });

    expect(result.weekly_frequency).toBe("5_plus");
  });

  it("maps frequencies 2, 3, 4 to string equivalents", () => {
    for (const freq of [2, 3, 4] as Frequency[]) {
      const result = mapOnboardingToProfile({
        gender: "male",
        goal: "build_strength",
        customGoal: null,
        frequency: freq,
        ...baseOnboardingData,
      });
      expect(result.weekly_frequency).toBe(String(freq));
    }
  });

  it("infers goal='custom' when customGoal is set", () => {
    const result = mapOnboardingToProfile({
      gender: "male",
      goal: null,
      customGoal: "Run a marathon",
      frequency: 3,
      ...baseOnboardingData,
    });

    expect(result.goal).toBe("custom");
    expect(result.custom_goal).toBe("Run a marathon");
  });

  it("throws on invalid state: no goal and no customGoal", () => {
    expect(() =>
      mapOnboardingToProfile({
        gender: "male",
        goal: null,
        customGoal: null,
        frequency: 3,
        ...baseOnboardingData,
      })
    ).toThrow();
  });

  it("throws when custom_goal exceeds 500 chars", () => {
    expect(() =>
      mapOnboardingToProfile({
        gender: "male",
        goal: null,
        customGoal: "a".repeat(501),
        frequency: 3,
        ...baseOnboardingData,
      })
    ).toThrow();
  });

  it("derives training preferences from onboarding data", () => {
    const result = mapOnboardingToProfile({
      gender: "male",
      goal: "build_strength",
      customGoal: null,
      frequency: 4,
      equipment: "full_gym",
      experience: "intermediate",
      strengthBaselines: [],
    });

    expect(result.training_split).toBe("upper_lower");
    expect(result.training_style).toBe("strength");
    expect(result.session_duration_minutes).toBe(45);
    expect(result.equipment_level).toBe("full_gym");
    expect(result.difficulty_level).toBe("intermediate");
    expect(result.training_setup_completed).toBe(true);
  });
});

describe("upsertProfile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockSupabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    (mockSupabase.rpc as jest.Mock).mockResolvedValue({ error: null });
  });
  const answers = {
    gender: null,
    goal: "build_strength" as const,
    customGoal: null,
    frequency: 3 as const,
    ...baseOnboardingData,
  };
  it("saves completion and baselines together through the owned atomic RPC", async () => {
    await upsertProfile(answers, "user-123");
    expect(mockSupabase.rpc).toHaveBeenCalledWith("complete_onboarding", {
      p_expected_user_id: "user-123",
      p_profile: expect.objectContaining({
        onboarding_completed: true,
        weekly_frequency: "3",
      }),
      p_baselines: [],
    });
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
  it("rejects an account change before submitting", async () => {
    await expect(upsertProfile(answers, "other-user")).rejects.toThrow(
      "Account changed"
    );
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });
  it("surfaces transaction failures", async () => {
    (mockSupabase.rpc as jest.Mock).mockResolvedValue({
      error: { message: "invalid baselines" },
    });
    await expect(upsertProfile(answers)).rejects.toThrow("invalid baselines");
  });
});
