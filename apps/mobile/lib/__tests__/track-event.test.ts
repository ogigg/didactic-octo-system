import { trackEvent } from "../track-event";

describe("trackEvent", () => {
  it("does not throw when called", () => {
    expect(() => trackEvent("onboarding_completed", {})).not.toThrow();
  });

  it("does not throw with step payload", () => {
    expect(() =>
      trackEvent("onboarding_step_completed", {
        step: "gender",
        skipped: false,
      })
    ).not.toThrow();
  });
});
