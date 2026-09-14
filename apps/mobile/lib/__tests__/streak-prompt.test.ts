import type {
  StreakPromptState,
  StreakStatus,
} from "@/lib/api/streak-protection";
import {
  canRestartStreak,
  formatCoveredWeekRange,
  getAvailableProtection,
  getStreakPromptPresentation,
  shouldOfferProHint,
} from "../streak-prompt";

const baseStatus: StreakStatus = {
  tier: "free",
  is_pro_active: false,
  current_streak_weeks: 0,
  longest_streak_weeks: 4,
  last_workout_at: "2026-06-28T10:00:00Z",
  days_since_last_workout: 10,
  missed_week_count: 1,
  earned_freezes_available: 0,
  pro_freezes_available: 0,
  lifetime_rescue_available: true,
  auto_apply_enabled: true,
  prompt_state: "free_lifetime_rescue",
  should_show_prompt: true,
  covered_week_start: "2026-06-29",
  covered_week_end: "2026-07-05",
};

const calmContext = {
  isWorkoutActive: false,
  isPaywallOpen: false,
  hiddenPromptState: null,
};

function withState(
  prompt_state: StreakPromptState,
  overrides: Partial<StreakStatus> = {}
): StreakStatus {
  return { ...baseStatus, prompt_state, ...overrides };
}

describe("getStreakPromptPresentation", () => {
  it("shows nothing while status is loading or the backend is in cooldown", () => {
    expect(getStreakPromptPresentation(undefined, calmContext)).toBeNull();
    expect(
      getStreakPromptPresentation(
        withState("free_comeback", { should_show_prompt: false }),
        calmContext
      )
    ).toBeNull();
    expect(
      getStreakPromptPresentation(withState("none"), calmContext)
    ).toBeNull();
  });

  it.each<StreakPromptState>([
    "free_earned_freeze",
    "free_lifetime_rescue",
    "free_comeback",
    "pro_available_freeze",
    "pro_comeback",
  ])("uses a sheet when %s needs a decision", (state) => {
    expect(getStreakPromptPresentation(withState(state), calmContext)).toBe(
      "sheet"
    );
  });

  it.each<StreakPromptState>(["at_risk", "pro_auto_applied"])(
    "uses an inline card for the informational %s state",
    (state) => {
      expect(getStreakPromptPresentation(withState(state), calmContext)).toBe(
        "card"
      );
    }
  );

  it("never interrupts an active workout or another overlay", () => {
    expect(
      getStreakPromptPresentation(withState("free_comeback"), {
        ...calmContext,
        isWorkoutActive: true,
      })
    ).toBeNull();
    expect(
      getStreakPromptPresentation(withState("at_risk"), {
        ...calmContext,
        isWorkoutActive: true,
      })
    ).toBeNull();
    expect(
      getStreakPromptPresentation(withState("free_comeback"), {
        ...calmContext,
        isPaywallOpen: true,
      })
    ).toBeNull();
  });

  it("stays hidden for the state the user already dismissed this session", () => {
    expect(
      getStreakPromptPresentation(withState("free_comeback"), {
        ...calmContext,
        hiddenPromptState: "free_comeback",
      })
    ).toBeNull();
    expect(
      getStreakPromptPresentation(withState("free_comeback"), {
        ...calmContext,
        hiddenPromptState: "at_risk",
      })
    ).toBe("sheet");
  });
});

describe("getAvailableProtection", () => {
  it("maps each prompt state to the protection it can spend", () => {
    expect(getAvailableProtection(withState("free_lifetime_rescue"))).toBe(
      "lifetime_rescue"
    );
    expect(
      getAvailableProtection(
        withState("free_earned_freeze", { earned_freezes_available: 1 })
      )
    ).toBe("earned_freeze");
    expect(
      getAvailableProtection(
        withState("pro_available_freeze", { pro_freezes_available: 2 })
      )
    ).toBe("pro_freeze");
  });

  it("refuses to offer a protection the balance cannot back", () => {
    expect(
      getAvailableProtection(
        withState("free_lifetime_rescue", { lifetime_rescue_available: false })
      )
    ).toBeNull();
    expect(
      getAvailableProtection(
        withState("free_earned_freeze", { earned_freezes_available: 0 })
      )
    ).toBeNull();
    expect(
      getAvailableProtection(
        withState("pro_available_freeze", { pro_freezes_available: 0 })
      )
    ).toBeNull();
    expect(getAvailableProtection(withState("free_comeback"))).toBeNull();
  });
});

describe("secondary options", () => {
  it("mentions Pro only to free users who have no protection left", () => {
    expect(shouldOfferProHint(withState("free_lifetime_rescue"))).toBe(true);
    expect(shouldOfferProHint(withState("free_comeback"))).toBe(true);
    expect(shouldOfferProHint(withState("free_earned_freeze"))).toBe(false);
    expect(
      shouldOfferProHint(withState("pro_comeback", { is_pro_active: true }))
    ).toBe(false);
  });

  it("offers a restart only once no protection can cover the week", () => {
    expect(canRestartStreak(withState("free_comeback"))).toBe(true);
    expect(canRestartStreak(withState("pro_comeback"))).toBe(true);
    expect(canRestartStreak(withState("free_lifetime_rescue"))).toBe(false);
    expect(canRestartStreak(withState("at_risk"))).toBe(false);
  });
});

describe("formatCoveredWeekRange", () => {
  it("formats the covered week in the active locale", () => {
    expect(formatCoveredWeekRange(baseStatus, "en")).toBe("Jun 29 – Jul 5");
    expect(formatCoveredWeekRange(baseStatus, "pl")).toMatch(/29 cze/);
  });

  it("returns null when no week is covered or the dates are malformed", () => {
    expect(
      formatCoveredWeekRange(
        { covered_week_start: null, covered_week_end: null },
        "en"
      )
    ).toBeNull();
    expect(
      formatCoveredWeekRange(
        { covered_week_start: "not-a-date", covered_week_end: "2026-07-05" },
        "en"
      )
    ).toBeNull();
  });
});
