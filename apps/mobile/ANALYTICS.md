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

### Workout Events

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

## Adding New Events

1. **Update Event Type**: Add the new event to the `EventName` type in `apps/mobile/lib/track-event.ts`

2. **Track the Event**: Use `trackEvent` in your component/hook

3. **Test Locally**: In development mode, events are logged to console

4. **Verify in PostHog**: Check the PostHog dashboard to confirm events are received

## Development vs Production

- **Development**: Events are logged to console for debugging (`[analytics] event_name payload`)
- **Production**: Events are sent to PostHog for analytics and insights

## Privacy & Data Handling

- **No PII**: Events should never contain personally identifiable information
- **Opt-in**: Analytics are enabled by default, but users can opt-out via `disablePostHog()`
- **Local First**: Events are batched and sent periodically (20 events or 30 seconds)
- **Error Handling**: Failed events don't crash the app; errors are logged for debugging

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

## Future Enhancements

- [ ] Implement feedback_given event (requires UI)
- [ ] Add screen view tracking
- [ ] Implement user funnels
- [ ] Add A/B testing support
- [ ] Configure data retention policies
- [ ] Set up dashboards and alerts
