# Database Schema Reference

> **Document status:** Reference document
> **Purpose:** Explain the current database model at a level that is useful for humans and AI agents, while treating `supabase/migrations` as the authoritative schema source.
> **Last reviewed:** 2026-09-26

## Source Of Truth

The exact database schema lives in `../supabase/migrations`.

Use this document to understand:

- what each table is for
- which columns matter semantically
- how tables relate to each other
- which invariants matter when changing the schema

Do not use this file as a substitute for checking the SQL migrations when exact column definitions, policies, or RPCs matter.

## Maintenance Note For AI Agents

If you add or materially change an important table, column, relationship, or invariant, update this file in the same change.

This document is intentionally curated, so not every low-signal column needs a description, but schema changes that affect product behavior or developer reasoning should be reflected here.

## Schema Overview

The data model is organized around four areas:

1. identity and preferences
2. workout planning and execution
3. progress and personalization
4. operational / product support

## Cross-Cutting Invariants

- `profiles.id` is a 1:1 extension of `auth.users.id`
- most user-owned tables reference `profiles(id)` and are protected by RLS
- the workout execution chain is:
  `workout_sessions -> session_exercises -> session_sets -> set_logs`
- each `session_set` has at most one `set_log`
- a set can be load/reps based or duration based, but it must have a valid target shape
- migrations are authoritative; this file is explanatory

## Identity And Preferences

### `profiles`

Purpose:

- canonical per-user profile row
- onboarding state, training preferences, and subscription state live here

Important columns:

- `id`: matches the authenticated user ID
- `goal`, `custom_goal`, `weekly_frequency`, `gender`: onboarding and goal context
- `onboarding_completed`: whether the user finished the onboarding flow
- `training_split`, `session_duration_minutes`, `equipment_level`, `training_style`, `difficulty_level`, `training_custom_prompt`: core training preference inputs used to shape generation
- `training_setup_completed`: whether the user finished the richer training setup flow
- `weight_unit`: display preference for weight values — `kg` (default) or `lbs`. All data remains stored in metric; this controls display conversion only.
- `weight_increments`: optional per-equipment load steps as JSONB keyed by equipment category (`barbell` | `dumbbell` | `machine` | `cable`), each entry shaped `{ "base_kg": number, "micro_kg": number|null }` (e.g. machine with 4 kg pin steps + 1.1 kg magnetic micro-plates). NULL column or missing categories mean auto — the progression engine falls back to equipment-based defaults. Reachable increases for a category are combinations of `n × base_kg + m × micro_kg`; the server-side progression engine uses them so suggested loads are always physically settable.
- `initial_queue_generated_at`: when the first successful onboarding queue replacement was committed; a null value means the onboarding free retry is still available
- `queue_generation_request_id`, `queue_generation_started_at`: server-managed claim token and timestamp for the queue replacement currently being generated; claims expire after 15 minutes
- `is_admin`: grants access to the admin dashboard (`apps/admin`) and admin-only RLS policies; promoted manually via SQL or the service role
- `subscription_tier`, `subscription_expires_at`, `revenuecat_customer_id`: monetization / entitlement state, written by `update_subscription_status` (service role)
- `deletion_scheduled_at`: when non-null, the account is scheduled for hard deletion at this timestamp. Signing back in before then clears the flag. A scheduled job (`purge_expired_deletions()`) purges expired rows, which cascades to every user-owned table.

Relationships:

- parent row for most user-owned data

Notes:

- profile rows are auto-created when a new auth user is created
- this table is one of the most important sources of generation context
- onboarding profile and baseline writes go through `complete_onboarding(...)`, which locks the profile, validates the payload, and commits both records atomically; repeated calls after completion return the existing profile unchanged
- server-owned fields — `is_admin`, `subscription_tier`, `subscription_expires_at`, `revenuecat_customer_id`, `deletion_scheduled_at`, `initial_queue_generated_at`, `queue_generation_request_id`, `queue_generation_started_at` — cannot be changed by direct `anon`/`authenticated` writes. The `profiles_server_owned_fields_guard` trigger rejects such INSERT, upsert, and UPDATE statements with `42501`, even when the payload also contains allowed fields. A fresh row must carry the column defaults; an upsert or update may echo the current values. `SECURITY DEFINER` RPCs, `service_role`, and SQL sessions are not restricted, so `complete_onboarding`, the queue claim RPCs, and the account-deletion RPCs keep working
- ordinary preference fields (training setup, `weight_unit`, `weight_increments`, onboarding flags) stay directly writable by the owner
- account deletion is soft with a 14-day grace period — see `request_account_deletion`, `cancel_account_deletion`, `purge_expired_deletions`
- after the grace period, `purge_expired_deletions()` deletes the matching `auth.users` row; foreign-key cascades remove the profile and user-owned app data
- no separate legal, security, or fraud-retention archive is implemented in this repository; external store purchase and billing records are outside this database purge

### `strength_baselines`

Settings replace strength baselines atomically through `save_strength_baselines`.
Bodyweight repetitions may be zero (known inability); unanswered exercises have
no row. Weighted entries require both load and positive whole repetitions.
Loads are always stored in kilograms, regardless of the display unit.

Purpose:

- stores baseline strength markers used for load programming and generation logic

Important columns:

- `user_id`
- `exercise_key`: normalized baseline exercise identifier
- `load_kg`, `reps`

Relationships:

- many baseline rows per profile

Notes:

- unique per user + exercise key
- this is preference / calibration data, not workout history

### `exercise_preferences`

Purpose:

- stores whether a user prefers or dislikes specific exercises

Important columns:

- `user_id`
- `exercise_id`
- `preference`: `preferred`, `soft_dislike`, `hard_dislike`

Relationships:

- joins users to `exercises`

Notes:

- important for biasing future generation without fully manual planning
- `preferred` rows are the existing favorite-exercise signal and are surfaced in exercise picker search as favorites

## Workout Planning And Execution

### `exercises`

Purpose:

- local exercise catalog used by generation, validation, and exercise-detail experiences

Important columns:

- `name`
- `primary_muscles`, `secondary_muscles`
- `equipment`
- `difficulty_level`
- `exercise_type`: `weight` or `time`
- `catalog_status`: `active` or `retired`. Active exercises are available for generation and picker browsing; retired exercises remain resolvable for exact-ID history/detail lookups.
- `retired_at`: when the exercise left the active catalog
- `replacement_exercise_id`: optional pointer to a preferred replacement exercise when a retired movement has a curated successor
- `instructions`, `image_url`, `video_url`
- `external_id`: useful for seeded / imported data lineage

Relationships:

- referenced by `session_exercises`
- referenced by `exercise_preferences`

Notes:

- this table is product-critical because generated workouts should refer to known exercises
- time-based exercise support means downstream consumers cannot assume every exercise is load/reps based
- `id` is the stable exercise identity; `name` is canonical English display/fallback text and must not be treated as identity
- `image_url` and `video_url` are compatibility shortcuts. Rich media metadata lives in `exercise_media_assets`.
- exercise picker filter options are derived from active `primary_muscles` and `equipment` values in this table, then localized through `catalog_label_translations`
- exercises should be retired rather than deleted once referenced by workout history, preferences, or pending workout data. This keeps old workouts stable while allowing the active generation catalog to change over time.

### `exercise_media_assets`

Purpose:

- reviewed catalog-owned images and future video metadata for exercise illustrations

Important columns:

- `exercise_id`
- `kind`: `image` or `video`
- `purpose`: `thumbnail`, `hero`, `step`, `animated`, or `video`
- `source`: `curated`, `imported`, `generated`, or `placeholder`
- `status`: `draft`, `active`, `archived`, or `rejected`
- `storage_bucket`, `storage_path`, `public_url`
- `width`, `height`, `content_type`, `file_size_bytes`, `blurhash`
- `alt_text`, `attribution`, `license`, `source_url`, `checksum_sha256`

Relationships:

- many media assets per `exercises` row

Notes:

- authenticated users can read active media rows
- service role owns writes/imports
- only one active thumbnail and one active hero image are allowed per exercise
- assets are served from the public `exercise-media` Supabase Storage bucket because exercise catalog illustrations are not user-private

### `exercise_translations`

Purpose:

- localized exercise catalog display text keyed by stable exercise ID

Important columns:

- `exercise_id`
- `language_code`
- `name`
- `instructions`
- `source`

Relationships:

- joins to `exercises`

Notes:

- authenticated users can read translations
- service role owns writes/imports
- missing translations fall back to English/canonical `exercises` text
- generated workouts, session history, preferences, progression, and logs continue to use `exercise_id`

### `catalog_label_translations`

Purpose:

- localized display labels for canonical catalog tokens used by filters and summaries

Important columns:

- `label_type`: `muscle`, `equipment`, or `difficulty`
- `label_key`: canonical DB token
- `language_code`
- `display_name`

Notes:

- canonical `primary_muscles`, `equipment`, and `difficulty_level` values remain unchanged for filtering, generation, analytics, and progression
- localized labels are display/search concerns only
- every muscle and equipment key used by the exercise catalog (`supabase/data/exercises.json` and exercises inserted by migrations) needs a label row for each non-English app language; `apps/mobile/lib/api/__tests__/exercises.test.ts` reads the migrations and fails otherwise
- add label rows with insert-only migrations (`INSERT … VALUES … ON CONFLICT (label_type, label_key, language_code) DO NOTHING`); the check rejects migrations that delete label rows or change their keys

### `pending_workouts`

Purpose:

- queue of pre-generated or generating workouts for a user

Important columns:

- `user_id`
- `queue_position`
- `status`: `queued`, `generating`, `regenerating`, `ready`, `failed`
- `workout_data`: serialized generated workout payload
- `generation_source`
- `focus_area`
- `regeneration_count`
- `regeneration_feedback`: JSON array of manual regeneration attempts and optional user feedback
- `user_edits`
- `generation_attempt_id`: server-owned lease for the generation currently replacing this row

Relationships:

- owned by a profile

Notes:

- unique per user + queue position
- supports a pre-generated workout flow instead of generating only at the moment of use
- queue replacement generation keeps the current rows untouched while new workouts are generated; `replace_pending_workouts(...)` swaps the full ready queue in one transaction only after every requested workout succeeds
- `claim_queue_generation(...)` serializes replacements per profile and allows stale claims to be reclaimed after 15 minutes; a completed onboarding queue returns an idempotent already-ready result
- regeneration claims are owned by a durable `generation_attempts` row; a stale claim is recovered after five minutes and late responses cannot overwrite the recovered row

### `generation_attempts`

Purpose:

- durable request correlation, stage timing, fallback outcome, and recovery state for every workout generation attempt

Important columns:

- `request_id`, `user_id`, `function_name`, `trigger`
- `pending_workout_id`: optional target slot; queue workers may reserve this UUID before inserting the pending row
- `status`: `running`, `succeeded`, `succeeded_with_fallback`, `rejected`, `failed`, or `timed_out`
- `stage`, `stages`: current stage and an append-only JSON array of stage timing/details entries
- `started_at`, `updated_at`, `finished_at`, `duration_ms`
- `generation_source`, `fallback_reason`, `error_code`, `error_message`, `final_output`

Notes:

- service-role edge functions create, stage, finish, and commit attempts; admins can read them through RLS
- `(user_id, request_id)` is unique for parent attempts and `(user_id, request_id, pending_workout_id)` is unique for child/slot attempts, making retries idempotent while allowing queue children to share a request ID
- `complete_regeneration_attempt(...)` verifies the attempt is still running and owns the target row before atomically saving the generated workout, clearing `user_edits`, and finishing the attempt
- `finish_generation_attempt(...)` atomically rolls failed, rejected, and timed-out attempts back to `ready` when prior workout data exists (otherwise `failed`) and clears the generation lease
- `recover_stale_generation_attempts(...)` fences attempts older than five minutes, restores pending rows to `ready` when prior data exists (otherwise `failed`), releases legacy queue leases, and repairs legacy `queued`, `generating`, and `regenerating` rows without an attempt

### `workout_sessions`

Purpose:

- top-level record for an actual workout session, from plan through completion

Important columns:

- `user_id`
- `name`
- `status`: `active`, `completed`, `discarded`
- `generation_source`
- `goal_snapshot`, `custom_goal_snapshot`: freeze generation context at session creation time
- `warmup_duration_seconds`, `warmup_completed`: optional timer-only general warmup shown before session exercises; this is session-level and separate from exercise warmup sets
- `started_at`, `completed_at`
- `health_record_id`: linkage to Apple Health / Health Connect mirrored workouts

Relationships:

- parent of `session_exercises`

Notes:

- this table is the anchor for most workout history and stats
- snapshot fields matter because user goals and preferences can change later
- deleting a workout from history removes its `workout_sessions` row; foreign
  key cascades then remove its exercises, sets, logs, and session comments so
  the deleted workout no longer contributes to history, statistics,
  progression, or future workout generation
- deletion goes through `delete_workout_session(UUID)`, which verifies the
  authenticated owner and completed status, fails if no row is deleted, and
  returns `health_record_id` for best-effort platform cleanup. Health Connect
  records can be deleted by UUID; the current Apple Health library cannot
  delete workout records by UUID.
- `get_workout_session_detail(UUID)` returns the full session only to its
  owner or to `service_role` (used by `generate-next-workout`). Anonymous
  callers cannot execute it, and a NULL `auth.uid()` is rejected explicitly.

### `workout_session_comments`

Purpose:

- free-form user feedback on a workout; the last three comments are added to
  the generation prompt and shown read-only in workout history

Important columns:

- `user_id`, `workout_session_id`
- `comment`: 1–500 characters

Relationships:

- owned by a profile and attached to a `workout_sessions` row; both foreign
  keys cascade on delete

Notes:

- users can read and insert their own comments only; the insert policy also
  requires `workout_session_id` to be one of the caller's own sessions
- updates and deletes are service-role only

### `session_exercises`

Purpose:

- ordered list of exercises inside a workout session

Important columns:

- `workout_session_id`
- `exercise_id`
- `order_index`
- `rest_duration_seconds`
- `notes`
- `difficulty_feedback`

Relationships:

- belongs to a `workout_session`
- points to an `exercise`
- parent of `session_sets`

Notes:

- unique per session + exercise
- unique per session + order index
- difficulty feedback is a bridge from execution back into future generation
- deleting a logged exercise occurrence cascades to its `session_sets` and
  `set_logs`, removing it from statistics, progression, and generated-workout
  history
- completed exercise deletion goes through
  `delete_completed_session_exercise(UUID)`, which verifies ownership and
  completed status before performing the cascade
- completed exercise edits go through `update_completed_exercise_sets(UUID,
JSONB)`. The RPC verifies ownership and completed status, then replaces the
  exercise's completed set/log rows transactionally so adding, removing, or
  changing sets cannot leave partial history.

### `session_sets`

Purpose:

- planned sets for a session exercise

Important columns:

- `session_exercise_id`
- `set_number`
- `set_type`: currently warmup vs working
- `target_load_kg`
- `target_reps`
- `target_duration_seconds`

Relationships:

- belongs to `session_exercises`
- parent of `set_logs`

Notes:

- each row must have either a load/reps target pair or a duration target
- downstream code must not assume `target_load_kg` and `target_reps` are always present

### `set_logs`

Purpose:

- actual execution record for a planned set

Important columns:

- `session_set_id`
- `actual_load_kg`
- `actual_reps`
- `actual_duration_seconds`
- `rpe`
- `completed`
- `not_completed_reason`
- `started_at`, `completed_at`

Relationships:

- belongs to `session_sets`

Notes:

- unique on `session_set_id`, so each planned set has at most one log row
- completion rules allow either weight/reps completion or duration completion
- this is one of the highest-value tables for progression, stats, and exercise history
- set-level `rpe` feeds `get_exercise_progression_history.working_sets` and the deterministic progression engine; null RPE remains valid for backward compatibility

## Progress And Personalization

### `body_measurements`

Purpose:

- stores body composition and circumference tracking over time

Important columns:

- `user_id`
- `logged_at`
- `weight_kg`, `body_fat_pct`, `muscle_mass_kg`
- circumference fields such as `waist_cm`, `chest_cm`, `hips_cm`, `shoulders_cm`, arm and leg measurements

Relationships:

- owned by a profile

Notes:

- unique per user + date
- columns are nullable so a user can log partial measurements
- `update_body_measurement_date(user_id, old DATE, new DATE)` moves a row to
  another date. It runs as the caller (RLS applies) and rejects callers other
  than the owner or `service_role`
- this table is optimized for trend/history style features rather than workout generation

### `streak_protection_balances`

Purpose:

- stores the current spendable streak protection balance for a user
- supports free lifetime rescue, earned free freeze, Pro monthly freeze grants, and Pro auto-apply preferences

Important columns:

- `user_id`
- `lifetime_rescue_used_at`: when non-null, the user's one lifetime rescue has been spent
- `earned_freezes_available`: free earned freeze balance, capped at 1
- `pro_freezes_available`: Pro freeze balance, capped at 3
- `pro_freezes_granted_through_month`: month through which the Pro monthly grant has been processed
- `auto_apply_enabled`: whether Pro freezes may be applied automatically for missed streak weeks
- `streak_restarted_at`: anchor timestamp after which workout history counts toward the current streak
- `last_prompt_dismissed_at`, `last_prompt_state`: cooldown state for the mobile streak protection prompt

Relationships:

- one balance row per profile

Notes:

- users can read their own balance, but writes are intended to happen through streak protection RPCs
- `get_streak_status` lazily creates this row when needed and performs idempotent entitlement maintenance

### `streak_protection_events`

Purpose:

- ledger of streak protection grants, uses, restarts, comeback events, and prompt dismissals
- provides auditability for monetization-sensitive streak restores and freezes

Important columns:

- `user_id`
- `event_type`: `lifetime_rescue_used`, `earned_freeze_granted`, `earned_freeze_used`, `pro_freeze_granted`, `pro_freeze_used`, `pro_auto_freeze_used`, `streak_restarted`, `comeback_started`, `comeback_completed`, or `prompt_dismissed`
- `covered_week_start`, `covered_week_end`: the week protected by a restore/freeze event
- `streak_weeks_before`, `streak_weeks_after`
- `metadata`: contextual JSON for product analysis and debugging

Relationships:

- many events per profile

Notes:

- a partial unique index allows only one protection event per user + covered week
- protected weeks are counted alongside qualifying completed workout weeks by `get_streak_status`
- qualifying workout weeks require a completed `workout_sessions` row with at least one completed `set_logs` row
- the mobile total-workouts count does not yet apply the completed-set requirement; see the qualifying-workout discrepancy in `docs/superpowers/specs/2026-09-10-streak-protection-experience-design.md` (SWE-139)

## Operational / Product Support

### `feedback`

Purpose:

- user-submitted bug reports and feature requests

Important columns:

- `user_id`
- `type`
- `title`
- `description`
- `app_version`, `device_model`, `os_version`, `platform`
- `status`

Relationships:

- tied to authenticated users

Notes:

- this table is more operational than core product data
- service role workflows matter here more than normal user read access

### `generation_usage`

Purpose:

- rolling-window accounting for AI generation limits and subscription-aware allowance checks

Important columns:

- `user_id`
- `generation_trigger`
- `created_at`

Relationships:

- owned by a profile

Notes:

- this table exists to support rate limiting / entitlement logic rather than user-facing history
- writes are intended to happen through server-side logic / RPCs
- `check_generation_allowance` may be called by the owning authenticated user or by `service_role`; `record_generation_usage` and `update_subscription_status` are service-role-only because they mutate entitlement/accounting state through `SECURITY DEFINER` RPCs

### `llm_generation_logs`

Purpose:

- raw LLM request/response traces for every workout generation, used to debug bad model output (for example exercises generated with a `0` kg load)

Important columns:

- `user_id`, `pending_workout_id`: generation context (nullable)
- `attempt_id`, `request_id`: durable generation correlation (nullable for historical log rows)
- `function_name`: which edge function triggered the call (`generate-workout`, `generate-next-workout`)
- `model`: OpenRouter model used
- `status`: `success`, `parse_error`, `api_error`, or `timeout`
- `request_settings`: effective model request options (nullable for historical rows)
- `provider`: provider selected by OpenRouter, when returned
- `finish_reason`: provider termination reason such as `stop` or `length`
- `reasoning_tokens`: provider-reported hidden reasoning tokens
- `cost_usd`: provider-reported request cost in USD
- `failure_code`: stable application failure category used to explain fallback
- `request_messages`: full system + user prompt sent to the model
- `raw_response`: unmodified OpenRouter JSON response
- `parsed_content`: the JSON parsed out of the model content before app-level enrichment
- `reasoning_content`: separate reasoning/chain-of-thought field returned by the model, when present
- `error_message`, `duration_ms`, `prompt_tokens`, `completion_tokens`

Relationships:

- optionally tied to a profile and a pending workout
- optionally tied to a durable generation attempt

Notes:

- written exclusively by edge functions via the service role key
- RLS is enabled with an admin-only SELECT policy; regular users can never read generation logs
- surfaced in the admin dashboard (`apps/admin`) under Generations
- nullable diagnostics remain compatible with historical rows; the migration
  backfills provider, finish reason, reasoning tokens, and cost only when those
  values are already present in the retained raw response

The admin-only `llm_generation_metrics(...)` RPC aggregates model validity,
provider latency (average, p50, and p95), linked fallback attempts, token
usage, and cost in the database. It is `SECURITY INVOKER`, so the existing
admin-only RLS policies remain the data boundary.

## Admin Access

- `profiles.is_admin` grants access to the admin dashboard and admin-only RLS policies
- the `public.is_admin()` helper function is used by all admin policies (`exercises`, `exercise_translations`, `exercise_media_assets`, `llm_generation_logs`, and storage writes to the `exercise-media` bucket)
- admins are promoted manually: `UPDATE public.profiles SET is_admin = TRUE WHERE id = '<user-uuid>';` run as SQL or with the service role. Users cannot promote themselves (see `profiles`)
- the admin dashboard lives in `apps/admin` and authenticates with the same Supabase project as the mobile app; RLS remains the security boundary even for admins

## Authorization Model

Reviewed on 2026-09-26 (SWE-205). The migration
`20260926120000_harden_database_authorization.sql` holds the fixes.

Grants:

- Supabase default privileges give `anon` and `authenticated` full table DML
  and `EXECUTE` on every new `public` function. RLS and explicit revokes are
  the only boundary. `REVOKE ... FROM PUBLIC` does not remove those
  role-specific grants, so revoke from `anon`/`authenticated` by name.
- All 20 `public` tables have RLS enabled. Tables with no write policy for
  clients (`generation_usage`, `generation_attempts`, `llm_generation_logs`,
  `streak_protection_*`, `catalog_label_translations`) are written only by
  `SECURITY DEFINER` RPCs or `service_role`.

Tables:

- user-owned tables (`workout_sessions` and its children, `pending_workouts`,
  `strength_baselines`, `exercise_preferences`, `body_measurements`): owner-only
  CRUD through `auth.uid()`
- `profiles`: owner select/insert/update, with server-owned fields guarded by
  a trigger; no delete policy
- `workout_session_comments`: owner select and own-session insert; service
  role for everything else
- `feedback`: owner insert; service-role read and status updates
- catalog (`exercises`, `exercise_translations`, `exercise_media_assets`,
  `catalog_label_translations`): read for `authenticated` (media assets:
  active only); writes for admins through `is_admin()` or for `service_role`
- `generation_attempts`, `llm_generation_logs`: admin read, service write

Storage:

- the only bucket, `exercise-media`, is public, so media URLs are readable
  without auth on purpose. `storage.objects` allows reads for
  `authenticated` and writes only for admins or `service_role`.

`SECURITY DEFINER` routines:

- every `public` definer routine pins `search_path`. New or rewritten ones use
  `SET search_path = ''` with schema-qualified names. Older bodies pin
  `public, pg_temp`.
- service-only: `purge_expired_deletions` (pg_cron runs it as `postgres`;
  the `purge-expired-deletions` Edge Function uses the service role),
  `get_login_provider_hint` (only the rate-limited `login-provider-hint` Edge
  Function), generation attempt/queue writers, `record_generation_usage`,
  `update_subscription_status`, and `ensure_streak_protection_balance`
- user-scoped RPCs scope every read and write to `auth.uid()` (plus
  `service_role` where Edge Functions need it). Owner comparisons must handle
  a NULL `auth.uid()` explicitly (`IS NULL OR <>`, not a bare `!=`)
- anon can still execute catalog readers (`get_localized_*`,
  `localized_label_array`) and user-scoped read/edit RPCs, which return
  nothing or raise when `auth.uid()` is NULL. The pgTAP suite pins this set,
  so a new anon-executable definer function fails the test until reviewed.
- trigger functions (`handle_new_user`, `notify_workout_completed`,
  `guard_profile_server_owned_fields`) are not executable by clients; trigger
  firing does not check `EXECUTE`

Tests:

- SQL level: `supabase test db` (includes
  `supabase/tests/database-authorization.test.sql`)
- through PostgREST with real anon, user, admin, and service-role
  credentials: see the header of
  `supabase/tests/postgrest/database-authorization.test.ts`

## Relationships Summary

```text
auth.users
  -> profiles
     -> workout_sessions
        -> workout_session_comments
        -> session_exercises
           -> session_sets
              -> set_logs

profiles
  -> pending_workouts
  -> generation_attempts
  -> strength_baselines
  -> exercise_preferences
  -> body_measurements
  -> generation_usage
  -> streak_protection_balances
  -> streak_protection_events

exercises
  -> session_exercises
  -> exercise_preferences
```

## Important RPC / Schema Areas To Check In Migrations

When database-related work touches behavior, also inspect `supabase/migrations` for:

- workout detail / history RPCs
- verified workout deletion RPC (`delete_workout_session`)
- progression history RPC (`get_exercise_progression_history`)
- stats RPCs
- exercise detail RPCs
- editable exercise-history RPCs (`get_editable_exercise_history` and
  `update_completed_exercise_sets`) and verified exercise deletion RPC
  (`delete_completed_session_exercise`)
- measurement history RPCs
- generation allowance / subscription RPCs
- onboarding completion and queue replacement RPCs (`complete_onboarding`, `claim_queue_generation`, `release_queue_generation`, `replace_pending_workouts`)
- admin aggregate metrics (`generation_attempt_metrics`) respect the same admin-only attempt read policy
- model observability aggregates (`llm_generation_metrics`) respect admin-only model-log and attempt RLS
- generation recovery and fencing RPCs (`claim_generation_attempt`, `record_generation_attempt_stage`, `finish_generation_attempt`, `complete_regeneration_attempt`, `complete_pending_workout_attempt`, `recover_stale_generation_attempts`)
- streak protection RPCs

Those functions are part of the practical database interface even though they are not tables.

### `get_exercise_progression_history`

Purpose:

- returns the most recent completed performance for each requested exercise so the deterministic progression engine can override generated targets
- also returns optional warm-up logs from that same latest completed occurrence for previous-display UI

Return shape (per exercise):

- `exercise_id`
- `exercise_type`: `weight` or `time`
- `session_id`: source completed `workout_sessions.id`
- `session_completed_at`
- `difficulty_feedback`
- `working_sets`: JSON array of working-set logs with `load_kg`, `reps`, `duration_seconds`, `rpe`, and `completed`
- `warmup_sets`: JSON array of warm-up-set logs with the same element shape (may be null on older rows / empty history)

Invariants:

- only `completed` sessions contribute
- history comes only from the latest completed occurrence per exercise; incomplete sessions are ignored
- `working_sets` include only `set_type = 'working'`; `warmup_sets` include only `set_type = 'warmup'`
- progression and personal records must use `working_sets` only — warm-up never affects progression
- authenticated callers can request only their own history; `service_role` retains server-side access for generation
- `rpe` may be null on older logs; missing RPE must not break consumers
- progression decisions that hold load/reps/duration when any completed working-set RPE is `>= 9` rely on this RPC surface

### `get_stats_personal_records`

Purpose:

- returns all-time personal-record statistics for each exercise in the authenticated user's completed workout history

Return shape (per exercise):

- `exercise_id`
- `exercise_name`
- `max_weight_kg`: greatest completed working-set load
- `max_weight_reps`: reps from the exact working set selected for `max_weight_kg`
- `max_reps`: greatest completed working-set reps
- `max_reps_weight_kg`: load from the exact working set selected for `max_reps`
- `max_volume_set_kg`: greatest completed working-set load × reps
- `est_1rm_kg`: greatest Epley estimate among completed working sets with 1–10 reps (nullable)

Invariants:

- only `workout_sessions.status = 'completed'`, `set_logs.completed = true`, non-null actual load/reps, and `session_sets.set_type = 'working'` contribute; warm-up sets, active/incomplete sessions, incomplete logs, and other users' data are excluded
- the paired values come from the same exact selected set as their corresponding maximum; they are not independent maxima
- max-weight selection orders load descending, reps descending, workout `completed_at` descending (`NULLS LAST`), then set-log ID descending
- max-reps selection orders reps descending, load descending, workout `completed_at` descending (`NULLS LAST`), then set-log ID descending
- callers must be authenticated and receive only their own records; an authenticated user with no eligible sets receives `[]`

Onboarding supports `goal_type.build_muscle` and `frequency_type.1`. New submissions explicitly supply session duration and may supply a training-style override and optional `training_custom_prompt` (200 characters).
