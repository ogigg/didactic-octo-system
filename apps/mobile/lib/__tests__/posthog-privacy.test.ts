import { sanitizePostHogEvent } from "../posthog-privacy";

describe("sanitizePostHogEvent", () => {
  it("redacts exception messages while preserving grouping metadata", () => {
    const event = {
      event: "$exception",
      properties: {
        $exception_list: [
          {
            $exception_type: "Error",
            $exception_value: "Workout note with private details",
            stacktrace: {
              frames: [{ filename: "app.ts", function: "saveWorkout" }],
            },
          },
        ],
      },
    };

    expect(sanitizePostHogEvent(event)).toEqual({
      event: "$exception",
      properties: {
        $exception_list: [
          {
            $exception_type: "Error",
            $exception_value: "[redacted]",
            stacktrace: {
              frames: [{ filename: "app.ts", function: "saveWorkout" }],
            },
          },
        ],
        privacy_redacted: true,
      },
    });
  });

  it("does not change non-exception analytics events", () => {
    const event = {
      event: "workout_generated",
      properties: { generation_source: "llm" },
    };

    expect(sanitizePostHogEvent(event)).toBe(event);
  });
});
