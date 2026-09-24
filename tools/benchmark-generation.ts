/** Bounded, opt-in live benchmark. No user data or database writes. */
import {
  buildPrompt,
  llmResponseSchema,
  shortlistCatalog,
  EXERCISE_COUNTS,
  OPENROUTER_MODEL,
  OPENROUTER_URL,
  type ExerciseCatalogEntry,
} from "../supabase/functions/_shared/generator.ts";
import {
  expandModelWorkout,
  readModelContent,
  workoutResponseFormat,
  MODEL_MAX_TOKENS,
} from "../supabase/functions/_shared/generation-model.ts";

const key = Deno.env.get("OPENROUTER_API_KEY");
const url = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_KEY");
if (!key || !url || !serviceKey)
  throw new Error(
    "Required env: OPENROUTER_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY"
  );
const catalogResponse = await fetch(
  `${url}/rest/v1/exercises?select=id,name,exercise_type,primary_muscles,secondary_muscles,equipment,difficulty_level&catalog_status=eq.active&order=name&limit=100`,
  {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    signal: AbortSignal.timeout(10000),
  }
);
if (!catalogResponse.ok)
  throw new Error(`Catalog HTTP ${catalogResponse.status}`);
const catalog = shortlistCatalog(
  (await catalogResponse.json()) as ExerciseCatalogEntry[]
);
const samples = Math.min(5, Math.max(1, Number(Deno.args[0] ?? 2)));
if (!Number.isInteger(samples))
  throw new Error("Sample count must be an integer from 1 to 5");
const rows: Record<string, unknown>[] = [];
for (const config of [
  { name: "none-latency", reasoning: { enabled: false }, sort: "latency" },
  {
    name: "none-throughput",
    reasoning: { enabled: false },
    sort: "throughput",
  },
  { name: "low-latency", reasoning: { effort: "low" }, sort: "latency" },
]) {
  for (let i = 0; i < samples; i++) {
    const duration = [30, 60, 90, 15, 45][i];
    const counts = EXERCISE_COUNTS[duration];
    const prompt = buildPrompt(
      {
        goal: "build_muscle",
        custom_goal: null,
        weekly_frequency: "3",
        gender: null,
      },
      "full_body",
      duration,
      "full_gym",
      "hypertrophy",
      "beginner",
      undefined,
      catalog,
      []
    );
    const started = performance.now();
    const row: Record<string, unknown> = {
      config: config.name,
      duration_minutes: duration,
      valid: false,
    };
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          messages: [
            { role: "system", content: prompt.system },
            { role: "user", content: prompt.user },
          ],
          response_format: workoutResponseFormat(
            catalog.map((e) => e.id),
            counts.min,
            counts.max
          ),
          reasoning: config.reasoning,
          provider: { sort: config.sort, require_parameters: true },
          temperature: 0.4,
          max_tokens: MODEL_MAX_TOKENS,
        }),
        signal: AbortSignal.timeout(30000),
      });
      const raw = await res.json();
      Object.assign(row, {
        http_status: res.status,
        provider: raw.provider,
        finish_reason: raw.choices?.[0]?.finish_reason,
        prompt_tokens: raw.usage?.prompt_tokens,
        completion_tokens: raw.usage?.completion_tokens,
        reasoning_tokens:
          raw.usage?.completion_tokens_details?.reasoning_tokens,
        cost_usd: raw.usage?.cost,
      });
      if (!res.ok) throw new Error(raw.error?.message ?? `HTTP ${res.status}`);
      const workout = expandModelWorkout(
        JSON.parse(readModelContent(raw)),
        catalog,
        duration,
        counts
      );
      llmResponseSchema.parse(workout);
      Object.assign(row, {
        valid: true,
        exercise_count: workout.exercises.length,
        primary_muscles: [
          ...new Set(
            workout.exercises.flatMap(
              (ex) =>
                catalog.find((e) => e.id === ex.exercise_id)!.primary_muscles
            )
          ),
        ],
      });
    } catch (error) {
      row.error = error instanceof Error ? error.message : String(error);
    }
    row.duration_ms = Math.round(performance.now() - started);
    rows.push(row);
    console.log(JSON.stringify(row));
  }
}
for (const name of [...new Set(rows.map((r) => r.config))]) {
  const group = rows.filter((r) => r.config === name);
  const times = group
    .filter((r) => r.valid)
    .map((r) => r.duration_ms as number)
    .sort((a, b) => a - b);
  console.log(
    JSON.stringify({
      summary: name,
      samples: group.length,
      valid: times.length,
      median_valid_ms: times.length
        ? times[Math.floor(times.length / 2)]
        : null,
      cost_usd: group.reduce((sum, r) => sum + Number(r.cost_usd ?? 0), 0),
      note: "Small smoke sample; not a production p95 or quality evaluation.",
    })
  );
}
