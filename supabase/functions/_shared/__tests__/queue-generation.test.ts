import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  processQueueGeneration,
  QueueFailurePersistenceError,
  type QueueGenerationErrorDetails,
  type QueueGenerationItem,
} from "../queue-generation.ts";

function makeItems(count: number): QueueGenerationItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `workout-${index + 1}`,
    queue_position: index + 1,
    focus_area: "full_body",
  }));
}

Deno.test(
  "continues from a failed fourth workout to the fifth workout",
  async () => {
    const generatedPositions: number[] = [];
    const readyPositions: number[] = [];
    const failedPositions: number[] = [];
    const errors: QueueGenerationErrorDetails[] = [];

    const results = await processQueueGeneration({
      items: makeItems(5),
      markGenerating: () => Promise.resolve(),
      generate: (item) => {
        generatedPositions.push(item.queue_position);
        if (item.queue_position === 4) {
          return Promise.reject(new Error("Invalid generated workout"));
        }
        return Promise.resolve({ data: item.id, source: "llm" });
      },
      saveReady: (item) => {
        readyPositions.push(item.queue_position);
        return Promise.resolve();
      },
      markFailed: (item) => {
        failedPositions.push(item.queue_position);
        return Promise.resolve();
      },
      logError: (details) => errors.push(details),
    });

    assertEquals(generatedPositions, [1, 2, 3, 4, 5]);
    assertEquals(readyPositions, [1, 2, 3, 5]);
    assertEquals(failedPositions, [4]);
    assertEquals(results, [
      { position: 1, status: "ready", source: "llm" },
      { position: 2, status: "ready", source: "llm" },
      { position: 3, status: "ready", source: "llm" },
      { position: 4, status: "failed", error: "Invalid generated workout" },
      { position: 5, status: "ready", source: "llm" },
    ]);
    assertEquals(errors, [
      {
        item: {
          id: "workout-4",
          queue_position: 4,
          focus_area: "full_body",
        },
        stage: "generate",
        error: "Invalid generated workout",
      },
    ]);
  }
);

Deno.test(
  "marks a workout failed when its ready state cannot be saved",
  async () => {
    const failedPositions: number[] = [];
    const errors: QueueGenerationErrorDetails[] = [];

    const results = await processQueueGeneration({
      items: makeItems(2),
      markGenerating: () => Promise.resolve(),
      generate: (item) =>
        Promise.resolve({ data: item.id, source: "fallback_template" }),
      saveReady: (item) => {
        if (item.queue_position === 1) {
          return Promise.reject(new Error("Database update failed"));
        }
        return Promise.resolve();
      },
      markFailed: (item) => {
        failedPositions.push(item.queue_position);
        return Promise.resolve();
      },
      logError: (details) => errors.push(details),
    });

    assertEquals(failedPositions, [1]);
    assertEquals(results, [
      { position: 1, status: "failed", error: "Database update failed" },
      { position: 2, status: "ready", source: "fallback_template" },
    ]);
    assertEquals(errors[0].stage, "save_ready");
  }
);

Deno.test(
  "a stale run stops on a zero-row ownership update and does not record usage",
  async () => {
    const generatedPositions: number[] = [];
    const errors: QueueGenerationErrorDetails[] = [];
    let usageRecorded = false;

    await assertRejects(
      () =>
        processQueueGeneration({
          items: makeItems(3),
          markGenerating: (item) =>
            item.queue_position === 2
              ? Promise.reject(
                  new Error("Queue ownership lost before generation")
                )
              : Promise.resolve(),
          generate: (item) => {
            generatedPositions.push(item.queue_position);
            return Promise.resolve({ data: item.id, source: "llm" });
          },
          saveReady: () => Promise.resolve(),
          markFailed: (item) =>
            item.queue_position === 2
              ? Promise.reject(
                  new Error("Queue ownership lost before persisting failure")
                )
              : Promise.resolve(),
          logError: (details) => errors.push(details),
          onCompleted: () => {
            usageRecorded = true;
            return Promise.resolve();
          },
        }),
      QueueFailurePersistenceError,
      "Failed to persist failure for queue position 2"
    );

    assertEquals(generatedPositions, [1]);
    assertEquals(usageRecorded, false);
    assertEquals(
      errors.map(({ stage }) => stage),
      ["mark_generating", "mark_failed"]
    );
  }
);

Deno.test(
  "propagates markFailed persistence errors instead of reporting recovery",
  async () => {
    const error = await assertRejects(
      () =>
        processQueueGeneration({
          items: makeItems(1),
          markGenerating: () => Promise.resolve(),
          generate: () => Promise.reject(new Error("Generation failed")),
          saveReady: () => Promise.resolve(),
          markFailed: () =>
            Promise.reject(new Error("Failure update affected zero rows")),
          logError: () => {},
        }),
      QueueFailurePersistenceError
    );

    assertEquals(error.generationError, "Generation failed");
    assertEquals(error.persistenceError, "Failure update affected zero rows");
  }
);
