# Database Schema Reference

> **Document status:** Reference document
> **Purpose:** Explain the current database model at a level that is useful for humans and AI agents, while treating `supabase/migrations` as the authoritative schema source.
> **Last reviewed:** 2026-04-11

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
- `subscription_tier`, `subscription_expires_at`, `revenuecat_customer_id`: monetization / entitlement state
- `deletion_scheduled_at`: when non-null, the account is scheduled for hard deletion at this timestamp. Signing back in before then clears the flag. A scheduled job (`purge_expired_deletions()`) purges expired rows, which cascades to every user-owned table.

Relationships:

- parent row for most user-owned data

Notes:

- profile rows are auto-created when a new auth user is created
- this table is one of the most important sources of generation context
- account deletion is soft with a 14-day grace period — see `request_account_deletion`, `cancel_account_deletion`, `purge_expired_deletions`

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
- `instructions`, `image_url`, `video_url`
- `external_id`: useful for seeded / imported data lineage

Relationships:

- referenced by `session_exercises`
- referenced by `exercise_preferences`

Notes:

- this table is product-critical because generated workouts should refer to known exercises
- time-based exercise support means downstream consumers cannot assume every exercise is load/reps based

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
- `started_at`, `completed_at`
- `health_record_id`: linkage to Apple Health / Health Connect mirrored workouts

Relationships:

- parent of `session_exercises`

Notes:

- this table is the anchor for most workout history and stats
- snapshot fields matter because user goals and preferences can change later

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

exercises
  -> session_exercises
  -> exercise_preferences
```

## Important RPC / Schema Areas To Check In Migrations

When database-related work touches behavior, also inspect `supabase/migrations` for:

- workout detail / history RPCs
- stats RPCs
- exercise detail RPCs
- measurement history RPCs
- generation allowance / subscription RPCs

Those functions are part of the practical database interface even though they are not tables.
