jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    rpc: jest.fn(),
  },
}));

import { supabase } from "@/lib/supabase";
import {
  applyStreakProtection,
  dismissStreakPrompt,
  fetchStreakStatus,
  recordComebackEvent,
  restartStreak,
} from "../streak-protection";

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

const userId = "550e8400-e29b-41d4-a716-446655440000";

function mockAuthenticatedUser() {
  (mockSupabase.auth.getUser as jest.Mock).mockResolvedValue({
    data: { user: { id: userId } },
    error: null,
  });
}

describe("streak protection api", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticatedUser();
  });

  it("fetches and validates streak status", async () => {
    (mockSupabase.rpc as jest.Mock).mockResolvedValue({
      data: [
        {
          tier: "free",
          is_pro_active: false,
          current_streak_weeks: 4,
          longest_streak_weeks: 6,
          last_workout_at: "2026-07-01T10:00:00Z",
          days_since_last_workout: 8,
          missed_week_count: 1,
          earned_freezes_available: 0,
          pro_freezes_available: 0,
          lifetime_rescue_available: true,
          auto_apply_enabled: true,
          prompt_state: "free_lifetime_rescue",
          should_show_prompt: true,
          covered_week_start: "2026-06-29",
          covered_week_end: "2026-07-05",
        },
      ],
      error: null,
    });

    const status = await fetchStreakStatus();

    expect(status.prompt_state).toBe("free_lifetime_rescue");
    expect(mockSupabase.rpc).toHaveBeenCalledWith("get_streak_status", {
      p_user_id: userId,
    });
  });

  it("applies a streak protection through the RPC", async () => {
    (mockSupabase.rpc as jest.Mock).mockResolvedValue({
      data: null,
      error: null,
    });

    await applyStreakProtection("lifetime_rescue");

    expect(mockSupabase.rpc).toHaveBeenCalledWith("apply_streak_protection", {
      p_user_id: userId,
      p_protection_type: "lifetime_rescue",
    });
  });

  it("dismisses the current prompt state", async () => {
    (mockSupabase.rpc as jest.Mock).mockResolvedValue({
      data: null,
      error: null,
    });

    await dismissStreakPrompt("free_comeback");

    expect(mockSupabase.rpc).toHaveBeenCalledWith("dismiss_streak_prompt", {
      p_user_id: userId,
      p_prompt_state: "free_comeback",
    });
  });

  it("restarts the streak", async () => {
    (mockSupabase.rpc as jest.Mock).mockResolvedValue({
      data: null,
      error: null,
    });

    await restartStreak();

    expect(mockSupabase.rpc).toHaveBeenCalledWith("restart_streak", {
      p_user_id: userId,
    });
  });

  it("records comeback events", async () => {
    (mockSupabase.rpc as jest.Mock).mockResolvedValue({
      data: null,
      error: null,
    });

    await recordComebackEvent("comeback_started", {
      prompt_state: "free_comeback",
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith("record_comeback_event", {
      p_user_id: userId,
      p_event_type: "comeback_started",
      p_metadata: { prompt_state: "free_comeback" },
    });
  });
});
