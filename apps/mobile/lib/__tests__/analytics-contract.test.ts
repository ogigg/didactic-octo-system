import {
  analyticsEventSchemas,
  criticalFunnelEvents,
  validateEventPayload,
} from "../analytics-contract";

describe("analytics event contract", () => {
  it("rejects a deliberately broken critical event", () => {
    const result = validateEventPayload("workout_completed", {
      workout_name: "Leg day",
    });

    expect(result.success).toBe(false);
  });

  it("keeps every critical funnel stage in the contract", () => {
    for (const eventName of criticalFunnelEvents) {
      expect(analyticsEventSchemas[eventName]).toBeDefined();
    }
  });
});
