import {
  logWorkoutDeletionError,
  logWorkoutDeletionTrace,
} from "../workout-deletion-logger";

describe("workout deletion logger", () => {
  it("logs a shortened session reference instead of the full ID", () => {
    const info = jest.spyOn(console, "info").mockImplementation(() => {});

    logWorkoutDeletionTrace("rpc:start", {
      sessionId: "550e8400-e29b-41d4-a716-446655440010",
    });

    expect(info).toHaveBeenCalledWith("[workout-delete] rpc:start", {
      sessionRef: "55440010",
    });
  });

  it("preserves diagnostic metadata for failures", () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {});

    logWorkoutDeletionError("rpc:error", new Error("Function not found"), {
      sessionId: "550e8400-e29b-41d4-a716-446655440010",
      errorCode: "PGRST202",
      errorHint: "Apply the latest database migration",
    });

    expect(error).toHaveBeenCalledWith("[workout-delete] rpc:error", {
      errorCode: "PGRST202",
      errorHint: "Apply the latest database migration",
      sessionRef: "55440010",
      errorName: "Error",
      errorMessage: "Function not found",
    });
  });
});
