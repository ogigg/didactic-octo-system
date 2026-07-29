# Analytics Implementation Guide

## Overview

This app uses **PostHog** for analytics and event tracking. The implementation follows the project's existing patterns (similar to Supabase and i18n integration).

## Setup

### 1. Environment Variables

Add the following to your `.env` file (or copy from `.env.example`):

```bash
# PostHog Analytics Configuration
# Get your API key from https://app.posthog.com/project/settings
EXPO_PUBLIC_POSTHOG_KEY=your_posthog_project_api_key
EXPO_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

### 2. Package Installation

The PostHog React Native SDK is already installed:

```bash
npm install posthog-react-native
```

### 3. Configuration

PostHog is configured in `apps/mobile/lib/posthog.ts` and automatically initialized in `apps/mobile/app/_layout.tsx`.

## Usage

### Basic Event Tracking

Import the `trackEvent` function and use it throughout your app:

```typescript
import { trackEvent } from "@/lib/track-event";

// Basic event
trackEvent("workout_generated");

// Event with payload
trackEvent("workout_completed", {
  workout_name: "Full Body Workout",
  duration_seconds: 1200,
  exercise_count: 8,
});
```

### User Properties

Set user-specific properties (goals, preferences, etc.):

```typescript
import { setUserProperties } from "@/lib/track-event";

setUserProperties({
  goal: "build_strength",
  frequency: 3,
  equipment: "dumbbells",
});
```

### Reset User Data

Clear user analytics data (e.g., on logout):

```typescript
import { resetUser } from "@/lib/track-event";

resetUser();
```

## Tracked Events

### Onboarding Events

- **onboarding_step_completed**: When a user completes an onboarding step
- **onboarding_completed**: When onboarding flow is fully completed
- **strength_baseline_entered**: When a baseline value is submitted
  - `exercise_key`: pushups | pullups | db_bench | db_row | bb_bench | bb_squat | deadlift
  - `has_load`: boolean
  - `source`: onboarding | settings

### Workout Events

- **workout_queue_initialized**: Queue generation started
  - `count`: target queue size
  - `trigger`: onboarding | preference_change

- **workout_queue_ready**: All queued workouts are ready
  - `total_generation_time_ms`: total time from init to ready
  - `count`: queue size
  - `fallback_count`: number of fallback template workouts in queue

- **pending_workout_generated**: A single queued workout became ready
  - `generation_source`: llm | fallback_template | fallback_substitution
  - `trigger`: onboarding | preference_change | unknown
  - `generation_time_ms`: time from row creation to ready
  - `queue_position`: queue slot
  - `focus_area`: push | pull | legs | upper | lower | full_body

- **pending_workout_started**: User started a queued workout
  - `time_since_generated_ms`: age of workout when started
  - `was_edited`: boolean
  - `edit_count`: number of unique edit types applied

- **pending_workout_regenerated**: User manually regenerated a queued workout
  - `phase`: started | completed
  - `queue_position`: queue slot
  - `focus_area`: push | pull | legs | upper | lower | full_body
  - `previous_generation_source`: llm | fallback_template | fallback_substitution
  - `has_feedback`: boolean
  - `feedback_length`: number of characters supplied in regeneration feedback
  - Raw optional feedback is retained in `pending_workouts.regeneration_feedback` for product analytics; PostHog receives metadata only.

- **pending_workout_edited**: A queued workout draft was changed and persisted
  - `edit_type`: swap_exercise | change_sets | change_load | multiple

- **workout_preview_viewed**: Preview modal was opened
  - `queue_position`: queue slot
  - `time_on_screen_ms`: dwell time before exit

- **workout_generated**: When AI generates a new workout
  - `generation_source`: llm | fallback_template | fallback_substitution
  - `training_split`: full_body | upper_lower | push_pull_legs
  - `duration_minutes`: 15 | 30 | 45 | 60 | 90
  - `equipment`: bodyweight | dumbbells | barbell | full_gym
  - `training_style`: strength | hypertrophy | endurance | circuit
  - `difficulty`: beginner | intermediate | advanced
  - `exercise_count`: number of exercises in workout
  - `has_custom_prompt`: boolean

- **workout_completed**: When user finishes a workout
  - `workout_name`: name of the workout
  - `exercise_count`: number of exercises
  - `total_sets`: total sets in workout
  - `completed_sets`: number of completed sets
  - `completion_rate`: percentage of completion
  - `total_volume_kg`: total weight lifted
  - `duration_seconds`: workout duration in seconds
  - `goal_snapshot`: build_strength | lose_weight | improve_fitness | custom
  - `custom_goal_snapshot`: custom goal text if any

- **session_duration**: Duration tracking for completed sessions
  - `workout_name`: name of the workout
  - `duration_seconds`: workout duration in seconds
  - `exercise_count`: number of exercises
  - `completion_rate`: percentage of completion

- **feedback_given**: When user provides difficulty feedback (TODO - needs UI)
  - `exercise_id`: ID of the exercise
  - `difficulty`: too_easy | ok | too_hard
  - `session_id`: ID of the workout session

- **training_preferences_changed**: Training preferences were saved
  - `changed_fields`: array of changed columns
  - `triggered_queue_rebuild`: boolean

- **queue_state_on_open**: Queue snapshot when the home tab opens
  - `ready_count`: ready workouts
  - `generating_count`: queued + generating workouts
  - `total_count`: total queued workouts
  - `has_active_workout`: boolean

### Streak Protection Events

- **streak_status_viewed**: Streak status was loaded on a user-facing screen
  - `tier`: free | pro
  - `is_pro_active`: boolean
  - `streak_weeks`: current protected streak length
  - `missed_weeks`: number of missed weeks currently needing protection
  - `days_since_last_workout`: integer or null
  - `prompt_state`: none | at_risk | free_earned_freeze | free_lifetime_rescue | free_comeback | pro_auto_applied | pro_available_freeze | pro_comeback
  - `pro_freezes_available`: integer
  - `earned_freezes_available`: integer
  - `lifetime_rescue_available`: boolean
  - `auto_apply_enabled`: boolean

- **streak_prompt_shown**: Streak protection sheet became visible
  - Same payload as `streak_status_viewed`

- **streak_prompt_dismissed**: User dismissed the streak protection sheet without taking a primary action
  - Same payload as `streak_status_viewed`

- **streak_protection_applied**: User spent an eligible restore/freeze
  - Same payload as `streak_status_viewed`
  - `protection_type`: lifetime_rescue | earned_freeze | pro_freeze

- **streak_lifetime_rescue_used**: User spent the one lifetime free restore
  - Same payload as `streak_status_viewed`

- **streak_freeze_earned**: User earned a free streak freeze
  - Same payload as `streak_status_viewed`

- **streak_restarted**: User chose to restart the streak instead of protecting it
  - Same payload as `streak_status_viewed`

- **comeback_workout_started**: User began a return-to-training flow from the streak sheet
  - Same payload as `streak_status_viewed`

- **comeback_workout_completed**: User completed a comeback workout
  - Same payload as `streak_status_viewed`

- **streak_upgrade_tapped**: User tapped upgrade from a streak protection context
  - Same payload as `streak_status_viewed`

## Adding New Events

1. **Update Event Contract**: Add the event and its payload schema to `apps/mobile/lib/analytics-contract.ts`. `trackEvent` derives its event-specific payload type from this schema, so required-property drift must fail TypeScript.

2. **Update the Manifest When Applicable**: Journey-stage changes must update `apps/mobile/analytics-journey-manifest.json`.

3. **Track the Event**: Use `trackEvent` in the successful behavior callback, with an event-specific `occurrence_id` for an operational journey event.

4. **Add Behavior Coverage**: Operational journey events need a user-behavior assertion at their real instrumentation flow and a valid-payload case in `track-event.test.ts`.

5. **Run the Gate**: Run `npm --workspace mobile run analytics:check` and `npm --workspace mobile run test:analytics`.

6. **Verify in PostHog**: Check the PostHog dashboard to confirm events are received.

Runtime validation rejects malformed payloads and emits a privacy-safe `analytics_contract_violation` operational event containing only the event name, Zod issue codes and property paths. Configure an owner-visible PostHog alert for that operational event.

Operational journey events deduplicate by the stable `occurrence_id` documented in the manifest, not by volatile timing properties. The detector is intentionally process-local: an app process restart clears its memory, while persisted workout/session IDs continue to provide stable occurrence keys where available.

## Canonical Journey Dependency

This branch does **not** claim that the canonical customer journey is complete. The current operational manifest covers four existing workout-loop stages:

1. `onboarding_completed`
2. `workout_generated`
3. `pending_workout_started`
4. `workout_completed`

The required canonical contract has eight stages and remains blocked on:

- `SWE-79` (`Todo`) — canonical eight-stage taxonomy, metrics and identity semantics
- `SWE-81` (`Todo`) — acquisition, authentication and activation instrumentation

Release mode fails closed with those ticket IDs and statuses until both dependencies land and the manifest contains all eight approved stages.

## Release Data-Quality Checklist

Before a production release:

1. Protect the GitHub `production` environment with required reviewers.
2. Store `EXPO_TOKEN` and `POSTHOG_EXPECTED_KEY_SHA256` as `production` environment secrets.
3. Set `POSTHOG_EXPECTED_HOST` as a protected `production` environment variable. It must be an approved PostHog ingestion origin.
4. Store `EXPO_PUBLIC_POSTHOG_KEY` and `EXPO_PUBLIC_POSTHOG_HOST` as readable plaintext/sensitive values—not EAS secret visibility—in the EAS `production` environment used by `eas.json`, because `eas env:exec` cannot read secret-visibility values.
5. Run the **Production mobile release** workflow. It uses `eas env:exec --environment production`, compares the project-key fingerprint and exact host without printing the key, validates the AST/manifest contract, and fails closed on canonical dependencies.
6. Only the dependent `production-build` job may start EAS production builds.
7. Resolve the classified `install`, `config`, `schema`, `stage` or `dependency` issue before releasing. Alerts are paginated and deduplicated by classification, and ownership comes from the manifest/CODEOWNERS.

The TypeScript-AST gate ignores comments and statically dead calls, verifies each operational stage's file, success callback and `occurrence_id`, and is paired with real-flow behavioral tests. It does not use source-text regexes.

## Development vs Production

- **Development**: Events are logged to console for debugging (`[analytics] event_name payload`)
- **Production**: Events are sent to PostHog for analytics and insights

## Privacy & Data Handling

- **No PII**: Events should never contain personally identifiable information
- **Opt-in**: Analytics are enabled by default, but users can opt-out via `disablePostHog()`
- **Local First**: Events are batched and sent periodically (20 events or 30 seconds)
- **Error Handling**: Failed events don't crash the app; contract violations emit privacy-safe operational telemetry

## Troubleshooting

### Events Not Appearing in Dashboard

1. Check environment variables are set correctly
2. Verify PostHog API key is valid
3. Check console for error messages
4. Ensure app is in production mode (dev events only go to console)

### Performance Impact

- Events are sent asynchronously (non-blocking)
- Batched to minimize network requests
- Graceful degradation if PostHog is unavailable

## Suggested Dashboards

- `Generation pipeline`: `workout_queue_initialized` -> `pending_workout_generated` -> `pending_workout_started` -> `workout_completed`
- `Queue readiness`: `queue_state_on_open` broken down by `ready_count` and `generating_count`
- `Latency`: percentile chart on `pending_workout_generated.generation_time_ms`
- `Recovery + cost`: generation source mix, fallback rate, regeneration rate, and per-user weekly generation volume
