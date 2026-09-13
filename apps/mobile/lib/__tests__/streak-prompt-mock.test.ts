import { getMockStreakStatus } from "@/lib/streak-prompt-mock";

describe("getMockStreakStatus", () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_MOCK_STREAK_PROMPT_STATE;
  });

  it("builds a freeze-preview status from the development flag", () => {
    process.env.EXPO_PUBLIC_MOCK_STREAK_PROMPT_STATE = "free_earned_freeze";

    expect(getMockStreakStatus()).toMatchObject({
      prompt_state: "free_earned_freeze",
      should_show_prompt: true,
      earned_freezes_available: 1,
      is_pro_active: false,
    });
  });

  it("ignores invalid prompt states", () => {
    process.env.EXPO_PUBLIC_MOCK_STREAK_PROMPT_STATE = "unknown";

    expect(getMockStreakStatus()).toBeNull();
  });
});
