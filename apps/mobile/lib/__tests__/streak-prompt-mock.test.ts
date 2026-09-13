import {
  getMockStreakStatus,
  runMockStreakMutation,
} from "@/lib/streak-prompt-mock";

describe("runMockStreakMutation", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    delete process.env.EXPO_PUBLIC_MOCK_STREAK_PROMPT_FAIL;
  });

  it("resolves after a short delay by default", async () => {
    const promise = runMockStreakMutation();
    jest.runAllTimers();
    await expect(promise).resolves.toBeUndefined();
  });

  it("rejects when the fail flag is set", async () => {
    process.env.EXPO_PUBLIC_MOCK_STREAK_PROMPT_FAIL = "true";
    const promise = runMockStreakMutation();
    jest.runAllTimers();
    await expect(promise).rejects.toThrow("Mocked streak mutation failure");
  });
});

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
