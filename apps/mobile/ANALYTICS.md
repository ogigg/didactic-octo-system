# MVP analytics implementation guide

Sweaty uses PostHog for the launch funnel:

`signup -> onboarding -> queue ready -> workout started -> workout completed`

The implementation is deliberately small and privacy-first. Application code
must call `trackEvent` from `@/lib/track-event`; do not call the PostHog client
directly. The wrapper adds the schema version and shared context, validates the
event name at compile time, and removes unapproved or sensitive properties at
runtime.

## Configuration

Set these Expo variables in the EAS environment used for the build:

```bash
EXPO_PUBLIC_APP_ENV=preview       # development | preview | production
EXPO_PUBLIC_POSTHOG_KEY=phc_...
EXPO_PUBLIC_POSTHOG_HOST=https://<region>.i.posthog.com
EXPO_PUBLIC_POSTHOG_ENABLE_LOCAL=false
```

Use a separate PostHog project/key for preview. Local development is disabled
even when a key exists. To intentionally inspect local events, set
`EXPO_PUBLIC_POSTHOG_ENABLE_LOCAL=true` and use a development PostHog project.
Never put a production key in a local `.env` file.

The production and preview EAS environments must define the key and regional
ingestion host. A missing key does not block app startup, but the client logs an
actionable warning and does not capture events. Verify the configuration in a
real preview build before release.

The PostHog SDK is already installed. Session replay and touch autocapture are
disabled. React Native replay captures screenshots and this app contains
credentials, notes, measurements, strength data, and health-related screens;
enabling replay requires a separate masking and privacy review.

## Identity lifecycle

- Before authentication, PostHog uses its anonymous device ID.
- When Supabase returns a session, `useAuthStore` calls `identifyUser` with the
  Supabase user UUID. Email, names, provider tokens, and form values are never
  used as a distinct ID.
- Low-cardinality person properties can be queued with `setUserProperties` and
  are applied only after an identified UUID exists.
- A successful sign-out captures `user_signed_out`, flushes pending events, and
  calls `resetUser`. The next account on the same device therefore gets a new
  anonymous timeline.

## Shared properties

Every mobile custom event and manually captured screen contains:

- `analytics_schema_version` (currently `1`)
- `environment` (`development`, `preview`, `production`, or `test`)
- `app_version`
- `build_number`
- `platform`
- `locale`

The SDK supplies device and OS context. Server-side generation events include
`analytics_schema_version` and `environment`, while PostHog supplies their
ingestion context. Add a low-cardinality property to the event map before using
it in a dashboard.

## Event contract

`EventPayloadMap` in `apps/mobile/lib/track-event.ts` is the source of truth.
Properties are optional during migration of legacy instrumentation; new P0
events should include the required fields in the tables below.

### Authentication

| Event             | Core properties                                 |
| ----------------- | ----------------------------------------------- |
| `signup_started`  | `auth_method` (`email`, `apple`, `google`)      |
| `signin_started`  | `auth_method` (`email`, `apple`, `google`)      |
| `user_signed_up`  | `auth_method`, `is_email_confirmation_required` |
| `signup_failed`   | `auth_method`, `error_code`, `failure_stage`    |
| `user_signed_in`  | `auth_method`                                   |
| `signin_failed`   | `auth_method`, `error_code`, `failure_stage`    |
| `user_signed_out` | none                                            |

Error codes are normalized categories such as `invalid_credentials`, `network`,
`provider_cancelled`, `missing_token`, `rate_limited`, `timeout`, and `unknown`.
Never send Supabase's error message, email, password, or provider token.

### Onboarding

| Event                       | Core properties                                                                                      |
| --------------------------- | ---------------------------------------------------------------------------------------------------- |
| `onboarding_started`        | `entry_point`                                                                                        |
| `onboarding_step_viewed`    | `step`, `step_index`, `edit_mode`                                                                    |
| `onboarding_step_completed` | `step`, `step_index`, `edit_mode`, `skipped`                                                         |
| `onboarding_save_failed`    | `error_code` (and optional `step`)                                                                   |
| `onboarding_completed`      | `duration_seconds`, `goal_category`, `weekly_frequency`, `equipment`, `experience`, `baseline_count` |

Do not send gender, custom goal text, raw strength values, or other form data.

### Generation and queue readiness

| Event                       | Core properties                                                                                       |
| --------------------------- | ----------------------------------------------------------------------------------------------------- |
| `workout_queue_initialized` | `request_id`, `count`, `trigger`                                                                      |
| `pending_workout_generated` | `request_id`, `workout_id`, `generation_source`, `generation_time_ms`, `queue_position`, `focus_area` |
| `workout_generation_failed` | `request_id`, `queue_position`, `error_code`, `failure_stage`, `retryable`                            |
| `workout_queue_ready`       | `request_id`, `count`, `fallback_count`, `total_generation_time_ms`                                   |
| `workout_queue_failed`      | `request_id`, `ready_count`, `failed_count`, `error_code`                                             |
| `queue_state_on_open`       | `ready_count`, `generating_count`, `failed_count`, `total_count`, `has_active_workout`                |

`request_id` joins client intent with server-side generation outcomes. Use
`error_code` and `failure_stage`, never an exception object or raw prompt.

### Workout selection and execution

| Event                         | Core properties                                                                                                                                            |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `workout_preview_viewed`      | `workout_id`, `queue_position`, `generation_source`                                                                                                        |
| `pending_workout_edited`      | `workout_id`, `edit_type`                                                                                                                                  |
| `pending_workout_regenerated` | `workout_id`, `phase`, `has_feedback`, `feedback_length`, `previous_generation_source`                                                                     |
| `workout_started`             | `workout_session_id`, `workout_source`, `workout_id`, `generation_source`, `exercise_count`, `planned_set_count`, `has_warmup`, `was_edited`, `edit_count` |
| `workout_first_set_logged`    | `workout_session_id`, `seconds_since_start`                                                                                                                |
| `workout_progress_reached`    | `workout_session_id`, `progress_percent`, `seconds_since_start`                                                                                            |
| `workout_finish_requested`    | `workout_session_id`, `completion_rate`, `completed_sets`, `planned_sets`, `duration_seconds`                                                              |
| `workout_completed`           | `workout_session_id`, source fields, set counts, completion rate, duration, volume, `is_partial`                                                           |
| `workout_save_failed`         | `workout_session_id`, `error_code`, `retryable`, `is_offline`                                                                                              |
| `workout_discarded`           | `workout_session_id`, set counts, completion rate, duration, `discard_context`                                                                             |
| `workout_abandoned`           | `workout_session_id`, set counts, completion rate, duration, `stale_after_hours`                                                                           |

`workout_source` is one of `queued_ai`, `manual`, `template`, or `comeback`.
`generation_source` is nullable for manual and template workouts. Do not send
workout names, exercise names, notes, comments, or custom goal text.
`workout_completed` is emitted only after the database save succeeds, including
when an initially offline save later succeeds through the sync queue.

Legacy events (`pending_workout_started`, `workout_generated`, and
`session_duration`) remain accepted while dashboards migrate. New flows should
use the unified events above.

### Feedback, sharing, monetization, and streaks

The typed map retains the existing `difficulty_feedback_given`,
`workout_comment_submitted`, sharing, training preference, queue, and streak
events. Product feedback uses `product_feedback_submitted` and
`product_feedback_failed`; paywall context uses `paywall_viewed`,
`paywall_dismissed`, and `upgrade_tapped`.

Send only enum values, booleans, counts, and length buckets. The sanitizer
rejects `password`, `token`, `email`, names, comments, descriptions, raw errors,
measurements, health data, exercise/workout names, and custom goal snapshots.

## Manual screen tracking

`AnalyticsScreenTracker` observes Expo Router's pathname from the root layout.
Because Expo Router uses React Navigation 7, PostHog's automatic navigation
tracker is disabled. Paths are reduced to an allowlisted stable screen name
(`sign_in`, `home`, `onboarding_goal`, `workout_preview`, `workout`,
`workout_summary`, `history`, `statistics`, `profile`, `feedback`, and related
launch screens). Query strings, reset tokens, dynamic IDs, and arbitrary route
parameters are discarded.

## Testing and verification

Run from the repository root after dependencies are installed:

```bash
npm run check-types --workspace=mobile
npm test --workspace=mobile -- --runInBand
```

Focused tests cover payload filtering, normalized auth errors, screen-path
sanitization, identity/reset behavior, and the existing analytics call sites.

Before launch, verify in a preview build:

1. Email signup with and without confirmation, Apple/Google success, cancellation,
   and provider failure.
2. Onboarding step views/completion and a deliberate final-save failure.
3. Fast/slow/fallback/failed generation and queue readiness.
4. Queued AI, manual, template, and comeback workout starts through save,
   discard, and abandonment outcomes.
5. Sign out and sign into a second account; confirm separate PostHog persons.
6. Sample Live Events for the absence of credentials, PII, free text, and raw
   errors.

Keep PostHog event definitions and dashboard filters aligned with this file and
the TypeScript map. A schema change requires updating both in the same PR.

## Server-side generation telemetry setup

The Supabase `generate-workout` and `generate-workout-queue` Edge Functions emit
canonical generation outcomes directly to PostHog. The mobile client emits
intent and transport-failure events, but does not duplicate those canonical
outcomes. Delivery is best-effort and never blocks workout generation.
Configure the PostHog project token, regional ingestion host, and deployment
environment as Supabase secrets (choose the region that matches the PostHog
project; the examples below use US ingestion):

```bash
supabase secrets set \
  --project-ref <SUPABASE_PROJECT_REF> \
  POSTHOG_PROJECT_TOKEN=phc_<POSTHOG_PROJECT_TOKEN> \
  POSTHOG_HOST=https://us.i.posthog.com \
  APP_ENV=production
```

For an EU project, use `https://eu.i.posthog.com` instead. Do not commit either
secret or put the PostHog project key in a server-side source file.

Deploy both functions after setting the secrets:

```bash
supabase functions deploy generate-workout --project-ref <SUPABASE_PROJECT_REF>
supabase functions deploy generate-workout-queue --project-ref <SUPABASE_PROJECT_REF>
```

The mobile client sends a UUID `request_id` to each function. Server events use
the authenticated Supabase UUID as `distinct_id`, include an `event_id` and
PostHog `$insert_id` for deduplication, and never include prompts, feedback,
workout/exercise names, or raw provider errors.
