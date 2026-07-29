const mockCapture = jest.fn();
const mockRegister = jest.fn().mockResolvedValue(undefined);
const mockIdentify = jest.fn();
const mockReset = jest.fn();
const mockInvoke = jest.fn();

jest.mock("expo-crypto", () => ({
  randomUUID: jest.fn(() => "00000000-0000-4000-8000-000000000001"),
}));

jest.mock("../posthog", () => ({
  posthog: {
    capture: (...args: unknown[]) => mockCapture(...args),
    register: (...args: unknown[]) => mockRegister(...args),
    identify: (...args: unknown[]) => mockIdentify(...args),
    reset: (...args: unknown[]) => mockReset(...args),
  },
}));

jest.mock("../supabase", () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
  },
}));

import {
  getObservabilityHeaders,
  getJourneyStageForPath,
  identifyObservabilityUser,
  reportHandledOperationalError,
  reportOperationalMetric,
  resetObservabilityIdentity,
  setOperationalJourneyStage,
} from "../operational-observability";

describe("operational observability", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("groups handled failures using privacy-safe allowlisted metadata", () => {
    reportHandledOperationalError({
      area: "sync",
      operation: "save_workout",
      journeyStage: "post_workout",
      failureCode: "sync_dead_letter",
      retryCount: 15,
    });

    expect(mockCapture).toHaveBeenCalledWith(
      "operational_event",
      expect.objectContaining({
        outcome: "failure",
        severity: "critical",
        area: "sync",
        operation: "save_workout",
        journey_stage: "post_workout",
        failure_code: "sync_dead_letter",
        retry_count: 15,
      })
    );
  });

  it("records latency and recovery metrics", () => {
    reportOperationalMetric({
      area: "generation",
      operation: "stale_queue_recovery",
      journeyStage: "generation",
      outcome: "recovered",
      latencyMs: 1_200,
      queueAgeMs: 320_000,
      retryCount: 2,
    });

    expect(mockCapture).toHaveBeenCalledWith(
      "operational_event",
      expect.objectContaining({
        outcome: "recovered",
        latency_ms: 1_200,
        queue_age_ms: 320_000,
        retry_count: 2,
      })
    );
  });

  it("maps routes to stable journey stages for crash context", () => {
    expect(getJourneyStageForPath("/(onboarding)/goal")).toBe("activation");
    expect(getJourneyStageForPath("/generate-workout")).toBe("generation");
    expect(getJourneyStageForPath("/workout")).toBe("in_session");
    expect(getJourneyStageForPath("/workout-summary")).toBe("post_workout");
    expect(getJourneyStageForPath("/feedback")).toBe("profile");
    expect(getJourneyStageForPath("/delete-account")).toBe("startup");
  });

  it("registers journey stage as a PostHog super property", () => {
    setOperationalJourneyStage("in_session");

    expect(mockRegister).toHaveBeenCalledWith({
      journey_stage: "in_session",
    });
  });

  it("uses the authenticated server-issued opaque identity and resets it", async () => {
    const identity = `obs_${"a".repeat(64)}`;
    mockInvoke.mockResolvedValue({
      data: { observability_id: identity },
      error: null,
    });

    await identifyObservabilityUser();

    expect(mockInvoke).toHaveBeenCalledWith("observability-identity");
    expect(mockIdentify).toHaveBeenCalledWith(identity);
    expect(getObservabilityHeaders()).toEqual({
      "x-observability-id": identity,
    });

    resetObservabilityIdentity();
    expect(mockReset).toHaveBeenCalled();
    expect(getObservabilityHeaders()).toEqual({});
  });
});
