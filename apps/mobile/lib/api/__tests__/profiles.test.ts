jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
  },
}));

import { supabase } from "@/lib/supabase";
import { mapOnboardingToProfile, upsertProfile } from "../profiles";
import type { Frequency } from "@/stores/onboarding-store";

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe("mapOnboardingToProfile", () => {
  it("maps standard goal and gender", () => {
    const result = mapOnboardingToProfile({
      gender: "male",
      goal: "build_strength",
      customGoal: null,
      frequency: 3,
    });

    expect(result).toEqual({
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
    });

    expect(result.gender).toBe("prefer_not_to_say");
  });

  it("maps null gender (skipped) to null", () => {
    const result = mapOnboardingToProfile({
      gender: null,
      goal: "improve_fitness",
      customGoal: null,
      frequency: 4,
    });

    expect(result.gender).toBeNull();
  });

  it("maps frequency 5 to '5_plus'", () => {
    const result = mapOnboardingToProfile({
      gender: "female",
      goal: "build_strength",
      customGoal: null,
      frequency: 5,
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
      })
    ).toThrow();
  });
});

describe("upsertProfile", () => {
  it("calls supabase upsert with mapped data and user id", async () => {
    const mockUpsert = jest.fn();
    const mockSelect = jest.fn().mockReturnValue({
      single: jest.fn().mockResolvedValue({ data: {}, error: null }),
    });
    (mockSupabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    (mockSupabase.from as jest.Mock).mockReturnValue({
      upsert: mockUpsert.mockReturnValue({ select: mockSelect }),
    });

    await upsertProfile({
      gender: "female",
      goal: "build_strength",
      customGoal: null,
      frequency: 3,
    });

    expect(mockSupabase.from).toHaveBeenCalledWith("profiles");
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "user-123",
        gender: "female",
        goal: "build_strength",
        weekly_frequency: "3",
        onboarding_completed: true,
      })
    );
  });

  it("throws when user is not authenticated", async () => {
    (mockSupabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: null },
      error: { message: "not authenticated" },
    });

    await expect(
      upsertProfile({
        gender: "male",
        goal: "build_strength",
        customGoal: null,
        frequency: 2,
      })
    ).rejects.toThrow("not authenticated");
  });

  it("throws when supabase upsert returns an error", async () => {
    const mockUpsert = jest.fn();
    const mockSelect = jest.fn().mockReturnValue({
      single: jest.fn().mockResolvedValue({
        data: null,
        error: { message: "RLS violation" },
      }),
    });
    (mockSupabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    (mockSupabase.from as jest.Mock).mockReturnValue({
      upsert: mockUpsert.mockReturnValue({ select: mockSelect }),
    });

    await expect(
      upsertProfile({
        gender: "male",
        goal: "build_strength",
        customGoal: null,
        frequency: 2,
      })
    ).rejects.toThrow("RLS violation");
  });
});
