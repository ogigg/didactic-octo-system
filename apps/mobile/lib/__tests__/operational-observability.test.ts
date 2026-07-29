const mockCapture = jest.fn();
const mockCaptureException = jest.fn();
const mockRegister = jest.fn().mockResolvedValue(undefined);

jest.mock("../posthog", () => ({
  posthog: {
    capture: (...args: unknown[]) => mockCapture(...args),
    captureException: (...args: unknown[]) => mockCaptureException(...args),
    register: (...args: unknown[]) => mockRegister(...args),
  },
}));

import {
  getJourneyStageForPath,
  reportHandledOperationalError,
  reportOperationalMetric,
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

    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: "sync_dead_letter" }),
      expect.objectContaining({
        area: "sync",
        operation: "save_workout",
        journey_stage: "post_workout",
        failure_code: "sync_dead_letter",
        retry_count: 15,
        $exception_fingerprint: "sync:save_workout:sync_dead_letter",
      })
    );
    expect(mockCapture).toHaveBeenCalledWith(
      "operational_event",
      expect.objectContaining({ outcome: "failure", severity: "critical" })
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
});
