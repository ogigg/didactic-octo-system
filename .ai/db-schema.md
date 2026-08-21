# Database Schema Reference

> **Document status:** Reference document
> **Purpose:** Explain the current database model at a level that is useful for humans and AI agents, while treating `supabase/migrations` as the authoritative schema source.
> **Last reviewed:** 2026-08-21

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
- `is_admin`: grants access to the admin dashboard (`apps/admin`) and admin-only RLS policies; promoted manually via SQL
- `subscription_tier`, `subscription_expires_at`, `revenuecat_customer_id`: monetization / entitlement state
- `deletion_scheduled_at`: when non-null, the account is scheduled for hard deletion at this timestamp. Signing back in before then clears the flag. A scheduled job (`purge_expired_deletions()`) purges expired rows, which cascades to every user-owned table.

Relationships:

- parent row for most user-owned data

Notes:

- profile rows are auto-created when a new auth user is created
- this table is one of the most important sources of generation context
- account deletion is soft with a 14-day grace period — see `request_account_deletion`, `cancel_account_deletion`, `purge_expired_deletions`
- after the grace period, `purge_expired_deletions()` deletes the matching `auth.users` row; foreign-key cascades remove the profile and user-owned app data
- no separate legal, security, or fraud-retention archive is implemented in this repository; external store purchase and billing records are outside this database purge

### `strength_baselines`

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

Relationships:

- owned by a profile

Notes:

- unique per user + queue position
- supports a pre-generated workout flow instead of generating only at the moment of use

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
- `function_name`: which edge function triggered the call (`generate-workout`, `generate-next-workout`)
- `model`: OpenRouter model used
- `status`: `success`, `parse_error`, `api_error`, or `timeout`
- `request_messages`: full system + user prompt sent to the model
- `raw_response`: unmodified OpenRouter JSON response
- `parsed_content`: the JSON parsed out of the model content before app-level enrichment
- `reasoning_content`: separate reasoning/chain-of-thought field returned by the model, when present
- `error_message`, `duration_ms`, `prompt_tokens`, `completion_tokens`

Relationships:

- optionally tied to a profile and a pending workout

Notes:

- written exclusively by edge functions via the service role key
- RLS is enabled with an admin-only SELECT policy; regular users can never read generation logs
- surfaced in the admin dashboard (`apps/admin`) under Generations

## Admin Access

- `profiles.is_admin` grants access to the admin dashboard and admin-only RLS policies
- the `public.is_admin()` helper function is used by all admin policies (`exercises`, `exercise_translations`, `exercise_media_assets`, `llm_generation_logs`, and storage writes to the `exercise-media` bucket)
- admins are promoted manually: `UPDATE public.profiles SET is_admin = TRUE WHERE id = '<user-uuid>';`
- the admin dashboard lives in `apps/admin` and authenticates with the same Supabase project as the mobile app; RLS remains the security boundary even for admins

## Relationships Summary

```text
auth.users
  -> profiles
     -> workout_sessions
        -> session_exercises
           -> session_sets
              -> set_logs

profiles
  -> pending_workouts
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
- measurement history RPCs
- generation allowance / subscription RPCs
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
