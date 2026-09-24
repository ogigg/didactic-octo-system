import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  createGenerationTrace,
  generationFetch,
  type GenerationTrace,
} from "../generation-trace.ts";
import { generateSingleWorkout } from "../generator.ts";

const exerciseId = "11111111-1111-4111-8111-111111111111";
const catalog = [
  {
    id: exerciseId,
    name: "Squat",
    exercise_type: "weight",
    primary_muscles: ["Quadriceps"],
    secondary_muscles: [],
    equipment: ["Barbell"],
    difficulty_level: "beginner",
    image_url: null,
  },
];

function fixture() {
  const logs: Record<string, unknown>[] = [];
  const stages: { stage: string; details?: Record<string, unknown> }[] = [];
  const client = {
    from(table: string) {
      const query = {
        abortSignal() {
          return query;
        },
        select() {
          return query;
        },
        eq() {
          return query;
        },
        overlaps() {
          return query;
        },
        order() {
          return query;
        },
        in() {
          return query;
        },
        limit() {
          return query;
        },
        then(resolve: (value: unknown) => unknown) {
          return Promise.resolve(
            resolve({ data: table === "exercises" ? catalog : [], error: null })
          );
        },
        insert(row: Record<string, unknown>) {
          logs.push(row);
          return { abortSignal: () => Promise.resolve({ error: null }) };
        },
      };
      return query;
    },
    rpc() {
      return { abortSignal: () => Promise.resolve({ data: [], error: null }) };
    },
  } as unknown as SupabaseClient;
  const trace: GenerationTrace = {
    id: "22222222-2222-4222-8222-222222222222",
    requestId: "33333333-3333-4333-8333-333333333333",
    stage(name, details) {
      stages.push({ stage: name, details });
      return Promise.resolve();
    },
    finish() {
      return Promise.resolve();
    },
  };
  const params = {
    supabaseClient: client,
    loggingClient: client,
    userId: "user",
    trace,
    profile: {
      goal: "build_strength",
      custom_goal: null,
      weekly_frequency: "3",
      gender: null,
    },
    trainingSplit: "full_body",
    durationMinutes: 15,
    equipment: "full_gym",
    trainingStyle: "strength",
    difficulty: "beginner",
  };
  return { logs, stages, params };
}

Deno.test(
  "provider failure is correlated and yields an explicit fallback trace with corrected final loads",
  async () => {
    const previousKey = Deno.env.get("OPENROUTER_API_KEY");
    const previousFetch = globalThis.fetch;
    Deno.env.set("OPENROUTER_API_KEY", "test-key");
    globalThis.fetch = () =>
      Promise.resolve(new Response("busy", { status: 429 }));
    try {
      const { logs, stages, params } = fixture();
      const result = await generateSingleWorkout(params);
      assertEquals(result.success, true);
      assertEquals(result.generationSource, "fallback_template");
      assertEquals(result.fallbackReason, "provider_error");
      assertEquals(logs[0].attempt_id, params.trace.id);
      assertEquals(logs[0].request_id, params.trace.requestId);
      assertEquals(logs[0].status, "api_error");
      assertEquals(
        stages.find((s) => s.stage === "fallback")?.details?.reason,
        "provider_error"
      );
      assertEquals(stages.at(-1)?.stage, "validated");
      assertEquals(
        result.data?.exercises[0].sets
          .filter((s) => s.set_type === "working")
          .every((s) => (s.target_load_kg ?? 0) > 0),
        true
      );
    } finally {
      globalThis.fetch = previousFetch;
      if (previousKey === undefined) Deno.env.delete("OPENROUTER_API_KEY");
      else Deno.env.set("OPENROUTER_API_KEY", previousKey);
    }
  }
);

Deno.test(
  "missing provider configuration is a visible fallback rather than a missing trace",
  async () => {
    const previousKey = Deno.env.get("OPENROUTER_API_KEY");
    Deno.env.delete("OPENROUTER_API_KEY");
    try {
      const { logs, stages, params } = fixture();
      const result = await generateSingleWorkout(params);
      assertEquals(result.fallbackReason, "api_key_missing");
      assertEquals(
        stages.find((s) => s.stage === "fallback")?.details?.reason,
        "api_key_missing"
      );
      assertEquals(logs.length, 0);
      assertEquals(stages.at(-1)?.stage, "validated");
    } finally {
      if (previousKey !== undefined)
        Deno.env.set("OPENROUTER_API_KEY", previousKey);
    }
  }
);

Deno.test(
  "reasoning-only length response records token_limit with provider metrics and never parses reasoning",
  async () => {
    const previousKey = Deno.env.get("OPENROUTER_API_KEY");
    const previousFetch = globalThis.fetch;
    Deno.env.set("OPENROUTER_API_KEY", "test-key");
    globalThis.fetch = () =>
      Promise.resolve(
        Response.json({
          provider: "test",
          choices: [
            {
              finish_reason: "length",
              message: { content: "", reasoning: "We need a workout" },
            },
          ],
          usage: {
            completion_tokens: 1600,
            completion_tokens_details: { reasoning_tokens: 1600 },
            cost: 0.002,
          },
        })
      );
    try {
      const { logs, params } = fixture();
      const result = await generateSingleWorkout(params);
      assertEquals(result.fallbackReason, "token_limit");
      assertEquals(logs[0].reasoning_tokens, 1600);
      assertEquals(logs[0].provider, "test");
      assertEquals(logs[0].failure_code, "token_limit");
      assertEquals(logs[0].finish_reason, "length");
    } finally {
      globalThis.fetch = previousFetch;
      if (previousKey === undefined) Deno.env.delete("OPENROUTER_API_KEY");
      else Deno.env.set("OPENROUTER_API_KEY", previousKey);
    }
  }
);

Deno.test(
  "expired queue budget skips the model and preserves a usable fallback",
  async () => {
    const previousKey = Deno.env.get("OPENROUTER_API_KEY");
    const previousFetch = globalThis.fetch;
    Deno.env.set("OPENROUTER_API_KEY", "test-key");
    let calls = 0;
    globalThis.fetch = () => {
      calls++;
      throw new Error("Must not call provider");
    };
    try {
      const { params } = fixture();
      const result = await generateSingleWorkout({
        ...params,
        deadlineAt: Date.now(),
      });
      assertEquals(calls, 0);
      assertEquals(result.fallbackReason, "generation_budget");
      assertEquals(result.success, true);
    } finally {
      globalThis.fetch = previousFetch;
      if (previousKey === undefined) Deno.env.delete("OPENROUTER_API_KEY");
      else Deno.env.set("OPENROUTER_API_KEY", previousKey);
    }
  }
);

Deno.test(
  "transient provider retry is logged separately and compact output preserves public workout shape",
  async () => {
    const previousKey = Deno.env.get("OPENROUTER_API_KEY");
    const previousFetch = globalThis.fetch;
    Deno.env.set("OPENROUTER_API_KEY", "test-key");
    let calls = 0;
    globalThis.fetch = (_url, options) => {
      calls++;
      const request = JSON.parse(
        (options as { body?: string })?.body as string
      );
      assertEquals(request.reasoning, { enabled: false });
      assertEquals(request.response_format.type, "json_schema");
      assertEquals(request.attempt_number, undefined);
      if (calls === 1)
        return Promise.resolve(new Response("busy", { status: 503 }));
      return Promise.resolve(
        Response.json({
          provider: "test",
          choices: [
            {
              finish_reason: "stop",
              message: {
                content: JSON.stringify({
                  workout_name: "Strength",
                  training_strategy: "Conservative full-body training.",
                  exercises: [
                    {
                      exercise_id: exerciseId,
                      working_sets: 3,
                      load_kg: 20,
                      reps: 10,
                      duration_seconds: null,
                      rest_seconds: 90,
                      rationale: "A familiar squat pattern.",
                      notes: null,
                    },
                  ],
                }),
              },
            },
          ],
        })
      );
    };
    try {
      const { logs, params } = fixture();
      const result = await generateSingleWorkout(params);
      assertEquals(calls, 2);
      assertEquals(logs.length, 2);
      assertEquals(
        logs.map((l) => l.status),
        ["api_error", "success"]
      );
      assertEquals(
        (logs[0].request_settings as Record<string, unknown>).attempt_number,
        1
      );
      assertEquals(
        (logs[1].request_settings as Record<string, unknown>).attempt_number,
        2
      );
      assertEquals(result.generationSource, "llm");
      assertEquals(result.data?.exercises[0].sets.length, 4);
      assertEquals(result.data?.warmup?.duration_seconds, 180);
    } finally {
      globalThis.fetch = previousFetch;
      if (previousKey === undefined) Deno.env.delete("OPENROUTER_API_KEY");
      else Deno.env.set("OPENROUTER_API_KEY", previousKey);
    }
  }
);

Deno.test(
  "deadline abort covers response body reads, not only response headers",
  async () => {
    const previousKey = Deno.env.get("OPENROUTER_API_KEY");
    const previousFetch = globalThis.fetch;
    Deno.env.set("OPENROUTER_API_KEY", "test-key");
    globalThis.fetch = (_url, options) => {
      const signal = (options as { signal: AbortSignal }).signal;
      const body = new ReadableStream({
        start(controller) {
          signal.addEventListener(
            "abort",
            () =>
              controller.error(new DOMException("Aborted body", "AbortError")),
            { once: true }
          );
        },
      });
      return Promise.resolve(new Response(body));
    };
    try {
      const { logs, params } = fixture();
      const result = await generateSingleWorkout({
        ...params,
        deadlineAt: Date.now() + 5020,
      });
      assertEquals(result.fallbackReason, "llm_timeout");
      assertEquals(result.success, true);
      assertEquals(logs[0].status, "timeout");
    } finally {
      globalThis.fetch = previousFetch;
      if (previousKey === undefined) Deno.env.delete("OPENROUTER_API_KEY");
      else Deno.env.set("OPENROUTER_API_KEY", previousKey);
    }
  }
);

Deno.test(
  "bounded database transport preserves caller cancellation",
  async () => {
    const previousFetch = globalThis.fetch;
    const caller = new AbortController();
    let observed: AbortSignal | undefined;
    globalThis.fetch = (_input, init) => {
      observed = (init as { signal: AbortSignal }).signal;
      return Promise.resolve(new Response("ok"));
    };
    try {
      const response = await generationFetch("https://example.test", {
        signal: caller.signal,
      });
      await response.text();
      assertEquals(observed?.aborted, false);
      caller.abort();
      assertEquals(observed?.aborted, true);
    } finally {
      globalThis.fetch = previousFetch;
    }
  }
);

Deno.test(
  "exhausted budget skips optional media and progression database calls",
  async () => {
    const previousKey = Deno.env.get("OPENROUTER_API_KEY");
    Deno.env.delete("OPENROUTER_API_KEY");
    let calls = 0;
    const client = {
      from() {
        calls++;
        throw new Error("Unexpected media lookup");
      },
      rpc() {
        calls++;
        throw new Error("Unexpected progression lookup");
      },
    } as unknown as SupabaseClient;
    try {
      const { params } = fixture();
      const result = await generateSingleWorkout({
        ...params,
        supabaseClient: client,
        catalog: catalog as import("../generator.ts").ExerciseCatalogEntry[],
        deadlineAt: Date.now() - 1,
      });
      assertEquals(result.success, true);
      assertEquals(calls, 0);
    } finally {
      if (previousKey !== undefined)
        Deno.env.set("OPENROUTER_API_KEY", previousKey);
    }
  }
);

Deno.test(
  "expired tracing budget skips optional stages but still records terminal outcome",
  async () => {
    const calls: string[] = [];
    const client = {
      rpc(name: string) {
        calls.push(name);
        return Promise.resolve({
          data:
            name === "claim_generation_attempt"
              ? { status: "claimed", attempt_id: "a", request_id: "r" }
              : true,
          error: null,
        });
      },
    } as unknown as SupabaseClient;
    const trace = await createGenerationTrace(client, {
      requestId: "r",
      userId: "u",
      functionName: "test",
      trigger: "test",
      deadlineAt: Date.now() - 1,
    });
    await trace.stage("media");
    await trace.finish("succeeded");
    assertEquals(calls, [
      "claim_generation_attempt",
      "finish_generation_attempt",
    ]);
  }
);
