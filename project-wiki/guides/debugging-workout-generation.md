# Debugging Workout Generation

> **Document status:** Current reference
> **Purpose:** Locate generation failures, inspect fallbacks, and recover stale workout preparation.
> **Last reviewed:** 2026-09-22

## Start with a request ID

The regeneration error in the mobile preview includes a reference ID. Open the
admin **Generations** page and filter by that request UUID. If the request ID is
not available, filter by user UUID and time window. The same request may have a
queue-level attempt and one child attempt per workout.

Open an attempt to inspect its last stage, elapsed times, error, fallback reason,
final saved output, and linked raw model logs. A model log marked `success` means
model parsing succeeded; the attempt outcome determines whether generation and
persistence completed. Raw model output can differ from the final output because
progression and load corrections run afterward.

The dashboard counts attempts, including queue parents and children. Rejected
requests (such as exhausted allowance) are separate from operational failures.
Metrics are aggregated in PostgreSQL across the selected filters; the trace list
is paginated independently.

## Find the failed boundary

Each handler starts a 60-second generation budget. Each model exchange has a
30-second timeout including response-body reads, capped by the remaining handler
budget minus five seconds for finalization. Queue generation runs at most two
workouts concurrently and shares that deadline. Exhausted model budget records
`generation_budget` and uses the deterministic fallback without another API call.
This is a scheduling budget, not a guarantee against slow authentication/database
writes or a disconnected client. Optional media/progression lookups use the remaining budget and are skipped when
it expires, following the existing non-fatal lookup behavior. Optional stage
writes also stop at the deadline; terminal persistence remains required.
The five-minute stale-attempt recovery remains
in place for interrupted workers.

One retry is allowed for HTTP 429/502/503/504 only when at least six seconds remain
inside the original timeout and Retry-After is at most one second. Timeouts,
invalid output, refusals and exhausted output budgets are not automatically
retried. Each actual HTTP attempt has its own model-log row and
`request_settings.attempt_number`; zero-call fallbacks are recorded on the
workout attempt instead.

The default model remains `deepseek/deepseek-v4-flash-0731`, with reasoning disabled,
latency routing, required parameter support, strict JSON Schema output, a 3,200
token output ceiling and temperature 0.4. The server validates the compact answer
with Zod and semantic checks: eligible unique IDs, exercise count, and target
fields matching the exercise type. It expands working sets and adds warmup,
media, progression, and concise deterministic muscle explanations. Hidden
reasoning is never parsed as the answer.

`token_limit` means the provider returned finish reason `length`; `empty_response`,
`invalid_json`, `schema_validation`, `exercise_count`, `invalid_exercise_id`,
`duplicate_exercise`, `exercise_targets`, and `refusal` distinguish other output
failures. `transport_error` identifies a network failure;
`invalid_provider_response` identifies a malformed API envelope. These remain
compatible with the existing raw-log statuses; use
`failure_code` and the attempt's `fallback_reason` for the precise diagnosis.

Raw model logs include provider, finish reason, reasoning tokens, reported cost,
and effective settings/version. Raw log writes have a two-second timeout and use
`EdgeRuntime.waitUntil` when available; they do not delay deployed responses.
Lifecycle/ownership stages remain awaited because they support recovery. Stage
logging is capped at two seconds; database/auth transport is capped at eight
seconds per request while preserving caller cancellation.

Queue requests fetch the catalog once. Independent context reads and history
lookups run concurrently. Ordinary prompts shortlist up to 40 exercises with
muscle coverage and preferred choices. Same-focus queue sessions receive
preassigned distinct pools when the catalog is large enough; small catalogs and
custom instructions retain shared choices. Each prompt identifies its queue
position. Custom instructions and regeneration feedback bypass shortlist
restriction so named exercise requests are not silently filtered. Hard dislikes
are never restored, even if they exclude the whole catalog. Media is fetched
only for selected exercises after model generation.

| Stage                                | Check                                                                                                                                              |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication / request validation  | Function invocation response and Supabase gateway logs; requests rejected before an authenticated user is known cannot create a user-owned attempt |
| Allowance / rate limit               | Expected quota or daily regeneration denial; no model call is required                                                                             |
| Context / catalog                    | Database read error, missing profile, or no eligible exercises                                                                                     |
| LLM / response validation            | Linked model log: provider error, timeout, empty response, invalid JSON or schema                                                                  |
| Fallback                             | Explicit fallback reason; this can still produce a successful saved workout                                                                        |
| Progression / load correction        | Stage details contain deterministic decisions and corrected set counts                                                                             |
| Persistence                          | Attempt ownership, database errors, and whether the pending row still exists                                                                       |
| Successful attempt but unchanged app | Refetch/realtime/network state; compare the saved `final_output` with `pending_workouts.workout_data`                                              |

Supabase function logs include structured checkpoints with `request_id`,
`attempt_id`, and stage information. Search these identifiers rather than relying
only on a user's timestamp. Existing PostHog lifecycle events remain useful for
analytics, but their best-effort delivery is not the durable attempt record.

## Recover a stuck attempt

Attempts with no stage update for five minutes are stale. Recovery marks the
attempt `timed_out` and restores its owned pending row to `ready` if an older
workout exists, otherwise `failed`. A late worker cannot publish through an
expired attempt. The previous workout and edits survive failure; successful
regeneration clears old edits together with saving the new workout.

The mobile queue checks for stale pending rows when loading. An authenticated
operator can also invoke recovery through the database RPC. Ordinary users can
recover only their own rows; admins can recover across users:

```sql
-- From a service-role operational session, or an authenticated admin RPC call:
select public.recover_stale_generation_attempts();

-- Scope recovery to a reported user:
select public.recover_stale_generation_attempts('<user-uuid>'::uuid);
```

Recovery runs when called, not as a permanent background worker. Monitor stale
attempts even when users have closed the app. If scheduled recovery is needed,
call the same RPC from a trusted scheduled job; do not reset pending statuses
with an unrestricted client update.

## Inspect the database

```sql
select id, request_id, function_name, status, stage, error_code,
       error_message, fallback_reason, started_at, updated_at, finished_at
from public.generation_attempts
where request_id = '<request-uuid>'::uuid
order by started_at;

select id, status, generation_source, generated_at, user_edits,
       generation_attempt_id, workout_data
from public.pending_workouts
where id = '<pending-workout-uuid>'::uuid;

select id, request_id, attempt_id, status, error_message
from public.llm_generation_logs
where attempt_id = '<attempt-uuid>'::uuid
order by created_at;
```

Do not interpret an absent raw model log as an absent generation request. A
missing API key uses a traced fallback without calling the model; input,
allowance, and context failures also happen before any model exchange.

## Deploy and verify

Apply the generation-attempt and metrics migrations before deploying the updated
functions or admin app. For local development, run `supabase db push --local`.
Deploy `generate-workout`, `generate-workout-queue`, and `generate-next-workout`
together with their shared modules.

Verify successful regeneration clears old edits, a failed attempt retains the
old workout, duplicate requests cannot run concurrently, expired workers cannot
save, and fallback attempts are visible separately from failures. Keep raw
prompts and final outputs admin-only; they can contain user feedback. This change
does not add automatic retention deletion or external alert delivery.

## Benchmark a change

From the repository root, with valid keys in `supabase/.env`:

```sh
deno run --allow-env --allow-net --env-file=supabase/.env tools/benchmark-generation.ts 3
```

This explicitly makes paid OpenRouter calls: at most 15 (five samples per three
configurations), with a 30-second limit per call. It reads only the exercise
catalog, uses synthetic profiles, and makes no database writes. It compares
reasoning disabled with latency/throughput routing against low reasoning with
latency routing. Output contains timings, provider, tokens, reported cost and
validation results. Costs of timed-out requests may be unavailable.

September 22 smoke run (three requests per configuration, 30/60/90-minute
workouts, all completed responses served by Wafer):

| Configuration                  | Valid responses | Median valid response | Observed duration          |
| ------------------------------ | --------------- | --------------------- | -------------------------- |
| Reasoning disabled, latency    | 3/3             | 7.73s                 | 7.51–9.88s                 |
| Reasoning disabled, throughput | 3/3             | 10.21s                | 4.72–15.20s                |
| Low reasoning, latency         | 1/3             | 19.72s                | Two calls timed out at 30s |

The six reasoning-disabled responses used 734–1,235 completion tokens, zero
reasoning tokens, and 3,067 input tokens. The audited historical production
prompts used approximately 7,500–7,900 input tokens. These are different contexts,
not a controlled production comparison. The small sequential sample is subject
to caching and provider-load variation; it supports the reasoning change but
cannot establish production p95, routing superiority, or personalized workout
quality. Check saved-workout validity and queue latency after rollout, and review
representative generated workouts before broadening model/provider choices.

## Local verification

```sh
deno test --allow-env supabase/functions/_shared/__tests__
deno check supabase/functions/generate-workout/index.ts supabase/functions/generate-workout-queue/index.ts supabase/functions/generate-next-workout/index.ts
npm --workspace admin run check-types
supabase db push --local
supabase test db
```

Apply the diagnostics migration before deploying functions that write its new
columns, then deploy all three generation functions together and release the
admin app. Historical rows remain readable; missing metrics are shown as unknown,
not zero. No production database migration or function deployment is performed by
the benchmark command.

## Related sources

- [Admin setup](../../apps/admin/README.md)
- [Database schema](../../.ai/db-schema.md)
- [Shared generator](../../supabase/functions/_shared/generator.ts)
