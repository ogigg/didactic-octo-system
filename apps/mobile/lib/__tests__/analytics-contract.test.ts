import {
  analyticsEventSchemas,
  operationalJourneyEvents,
  validateEventPayload,
} from "../analytics-contract";

describe("analytics event contract", () => {
  it("rejects a deliberately broken operational journey event", () => {
    const result = validateEventPayload("workout_completed", {
      workout_name: "Leg day",
    });

    expect(result.success).toBe(false);
  });

  it("keeps every current operational journey stage in the contract", () => {
    for (const eventName of operationalJourneyEvents) {
      expect(analyticsEventSchemas[eventName]).toBeDefined();
    }
  });
});
