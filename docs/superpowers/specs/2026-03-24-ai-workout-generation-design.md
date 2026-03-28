# AI Workout Generation — Design Spec

## Problem

Users currently start workouts from static mock data or manually-created templates. There's no intelligent workout generation that adapts to user goals, history, or progressive overload. The database schema and workout logger are ready — the AI generation layer is the missing piece.

## Solution

A Supabase Edge Function that calls OpenRouter (Claude 3.5 Sonnet) to generate personalized workout proposals, presented in a single combined screen where users configure preferences, see the result, and start the workout.

---

## Architecture

```
Home Screen → [Generate AI Workout] → Generate Screen (configure + preview)
     ↓
  Focus area picker + Duration picker → "Generate Workout" button
     ↓
  Loading state ("Crafting your workout...")
     ↓
  Client: supabase.functions.invoke("generate-workout", { body: { focus_area, duration_minutes } })
     ↓
  ┌─────────────────────────────────────────────────┐
  │  Edge Function: generate-workout (Deno)         │
  │                                                 │
  │  1. Auth: verify JWT from Authorization header  │
  │  2. Fetch profile (goal, frequency, gender)     │
  │  3. Fetch last 4 completed sessions (detail)    │
  │  4. Fetch exercises filtered by focus area      │
  │  5. Build prompt with exercise IDs + context    │
  │  6. Call OpenRouter (Claude 3.5 Sonnet)         │
  │  7. Parse + Zod-validate JSON response          │
  │  8. Validate all exercise_ids exist in DB       │
  │     - Invalid → substitute from same muscles    │
  │  9. Return structured workout JSON              │
  │                                                 │
  │  Fallback: LLM fails → rule-based template      │
  └─────────────────────────────────────────────────┘
     ↓
  Preview: workout name, exercise cards with sets/reps/load
     ↓
  [Start Workout] → workout store → /workout logger
  [Regenerate] → re-call edge function
  [Swap exercise] → exercise-picker.tsx
```

---

## Edge Function: `generate-workout`

### Location

`supabase/functions/generate-workout/index.ts`

### Request

```typescript
// Validated with Zod at runtime in the edge function
interface GenerateWorkoutRequest {
  focus_area: "push" | "pull" | "legs" | "upper" | "lower" | "full_body";
  duration_minutes: 30 | 45 | 60;
}
```

### Response

```typescript
interface GenerateWorkoutResponse {
  workout_name: string;
  generation_source: "llm" | "fallback_template" | "fallback_substitution";
  goal_snapshot:
    | "build_strength"
    | "lose_weight"
    | "improve_fitness"
    | "custom";
  custom_goal_snapshot: string | null;
  exercises: GeneratedExercise[];
}

interface GeneratedExercise {
  exercise_id: string; // UUID — must exist in exercises table
  exercise_name: string; // denormalized for display
  sets: GeneratedSet[];
  rest_duration_seconds: number;
  notes: string | null; // AI coaching tip
}

interface GeneratedSet {
  set_type: "warmup" | "working";
  target_load_kg: number;
  target_reps: number;
}
```

### Logic

1. **Auth** — Extract JWT from `Authorization: Bearer <token>` header. Create Supabase client scoped to user.
2. **Profile** — Query `profiles` table for `goal`, `custom_goal`, `weekly_frequency`, `gender`.
3. **History** — Fetch last 4 completed sessions using `get_workout_session_detail` RPC. Extract: exercises used, loads achieved, difficulty feedback, dates.
4. **Exercise catalog** — Query `exercises` table filtered by focus area muscle mapping:
   - push → chest, shoulders, triceps
   - pull → back, biceps, forearms
   - legs → quadriceps, hamstrings, glutes, calves
   - upper → chest, shoulders, triceps, back, biceps
   - lower → quadriceps, hamstrings, glutes, calves
   - full_body → all muscle groups
   - Use `primary_muscles && ARRAY[...]` overlap query (GIN indexed)
5. **Prompt construction** — See Prompt Design section below.
6. **OpenRouter call** — `POST https://openrouter.ai/api/v1/chat/completions` with model `anthropic/claude-3.5-sonnet`, `response_format: { type: "json_object" }`.
7. **Validation** — Parse response with Zod schema. Verify every `exercise_id` exists in the fetched catalog.
8. **Substitution** — Replace invalid exercise IDs with valid exercises from the same muscle group. If any substitutions were made, set `generation_source: "fallback_substitution"`.
9. **Return** — Validated workout JSON including `goal_snapshot` and `custom_goal_snapshot` from the profile. `generation_source` is `"llm"` (all valid), `"fallback_substitution"` (some replaced), or `"fallback_template"` (LLM failed entirely).

### Fallback

If OpenRouter fails (network error, timeout >10s, invalid JSON, rate limit):

1. Select exercises from catalog based on focus area + goal heuristics
2. Apply default set/rep schemes per goal:
   - build_strength: 4x5 heavy
   - lose_weight: 3x12-15 moderate
   - improve_fitness: 3x8-10 moderate
3. Return with `generation_source: "fallback_template"`

### Rate Limiting

- 1 generation request per 30 seconds per user (prevent rapid "Regenerate" spam)
- Enforced in the edge function by checking the user's most recent `workout_sessions.created_at` with `generation_source = 'llm'`
- Returns HTTP 429 with a `retry_after` value if rate limited

### Secrets

`OPENROUTER_API_KEY` — stored in Supabase Edge Function secrets. Locally in `supabase/.env.local`.

---

## LLM Prompt Design

### System Message

You are a certified personal trainer creating a workout plan. You MUST respond with valid JSON matching the exact schema provided. Select exercises ONLY from the provided exercise catalog using their exact IDs. Design for progressive overload based on the user's history.

### User Message Content

- **Profile:** goal, custom_goal (if any), frequency, gender
- **Focus area** and **duration** from user selection
- **History summary:** Last 4 sessions — for each: date, exercises (name, sets x reps x kg, difficulty feedback)
- **Exercise catalog:** Array of `{id, name, primary_muscles, equipment, difficulty_level}` (filtered to focus area)
- **JSON schema:** Exact response format with field descriptions

### Constraints in Prompt

- Use only exercise IDs from the provided catalog
- 4-6 exercises for 30min, 5-7 for 45min, 6-9 for 60min
- Include 1 warmup set per compound exercise
- Apply progressive overload: if user completed previous load and feedback was "ok" or "too_easy", increase by 2.5-5kg
- If feedback was "too_hard", maintain or reduce load
- Generate a creative, motivating workout name
- Add brief coaching notes for exercises where technique matters

---

## Frontend: Generate Screen

### Route

`app/generate-workout.tsx` — full-screen modal (matches workout.tsx pattern)

### Single Screen, Two States

**State 1 — Configure (initial):**

- Header: "Generate Workout"
- Focus area: 6 pill/chip buttons in 2 rows (Push, Pull, Legs, Upper, Lower, Full Body)
- Duration: 3 pill buttons (30 min, 45 min, 60 min)
- "Generate Workout" CTA button (disabled until both selected)

**State 2 — Loading → Result:**

- Skeleton loading animation (~2-5s)
- On success: AI-generated workout name as title, scrollable exercise list
- Each exercise card: name, muscle tags, sets table (type, kg, reps), rest time, AI notes
- Bottom bar: "Start Workout" (primary button) | "Regenerate" (secondary/text button)
- Tap exercise → navigate to exercise-picker for swap (reuse existing)

### State Management

- Local `useState` for focus_area, duration_minutes, and generated workout
- TanStack Query mutation (`useMutation`) for the edge function call
- No Zustand store needed — ephemeral until user accepts

### Transition to Workout Logger

When "Start Workout" is tapped:

1. Map `GeneratedExercise[]` → `WorkoutExercise[]` using `mapGeneratedToWorkoutExercises()` (defined in `lib/api/ai-workout.ts`)
2. Store `generation_source`, `goal_snapshot`, `custom_goal_snapshot` from the response for use at save time
3. Call `workoutStore.startWorkout(workoutName, exercises)`
4. `router.push("/workout")`

The existing workout logger, save flow, and sync queue handle everything from there.

### Mapping: `GeneratedExercise` → `WorkoutExercise`

The workout store uses `string` for `kg`/`reps` (user-editable input fields) while the AI returns `number`. The mapping function converts:

```typescript
// GeneratedExercise → WorkoutExercise
{
  id: exercise_id,                           // reuse the exercise_id as the workout exercise id
  name: exercise_name,
  restDurationSeconds: rest_duration_seconds,
  notes: notes ?? "",
  sets: generatedSets.map((set, i) => ({
    id: `set-${exercise_id}-${i}-${Date.now()}`,
    type: set.set_type,
    kg: String(set.target_load_kg),          // number → string
    reps: String(set.target_reps),           // number → string
    rpe: null,
    isCompleted: false,
    previousDisplay: null,                   // could be populated from history in future
  }))
}
```

### Persisting `generation_source` and `goal_snapshot`

The response's `generation_source`, `goal_snapshot`, and `custom_goal_snapshot` must be passed through to `useSaveCompletedWorkout()` when the workout finishes. Options:

- **Recommended:** Add `generationMeta` field to workout store (`generation_source`, `goal_snapshot`, `custom_goal_snapshot`) — set when starting an AI workout, read when saving.
- The existing `mapWorkoutStoreToDb` function in `use-workout-mutations.ts` uses these values when creating the `workout_sessions` row.

---

## Client-Side Integration

### New Files

| File                                           | Purpose                             |
| ---------------------------------------------- | ----------------------------------- |
| `supabase/functions/generate-workout/index.ts` | Edge Function (Deno)                |
| `apps/mobile/lib/api/ai-workout.ts`            | Client API — calls edge function    |
| `apps/mobile/hooks/use-generate-workout.ts`    | TanStack Query mutation hook        |
| `apps/mobile/app/generate-workout.tsx`         | Combined configure + preview screen |

### Modified Files

| File                                                | Change                                                       |
| --------------------------------------------------- | ------------------------------------------------------------ |
| `apps/mobile/app/(tabs)/index.tsx`                  | Replace mock WorkoutPlanCard with "Generate AI Workout" card |
| `apps/mobile/i18n/locales/en/generate-workout.json` | New i18n namespace `generateWorkout` for generate screen     |

### Reused (No Changes)

- `stores/workout-store.ts` — `startWorkout()` accepts generated exercises
- `app/workout.tsx` — existing workout logger
- `app/exercise-picker.tsx` — for swapping exercises in preview
- `lib/api/workouts.ts` — save/sync mutations
- `hooks/use-workout-mutations.ts` — `useSaveCompletedWorkout()`
- `lib/sync-queue.ts` — offline persistence

---

## Focus Area → Muscle Group Mapping

| Focus Area | Primary Muscles                                     |
| ---------- | --------------------------------------------------- |
| push       | chest, shoulders, triceps                           |
| pull       | back, biceps, forearms                              |
| legs       | quadriceps, hamstrings, glutes, calves              |
| upper      | chest, shoulders, triceps, back, biceps, forearms   |
| lower      | quadriceps, hamstrings, glutes, calves, hip flexors |
| full_body  | all muscle groups                                   |

---

## Error Handling

| Scenario                        | Handling                                              |
| ------------------------------- | ----------------------------------------------------- |
| OpenRouter timeout (>10s)       | Fallback to rule-based template                       |
| Invalid JSON from LLM           | Fallback to rule-based template                       |
| Invalid exercise_id in response | Substitute with valid exercise from same muscle group |
| Network error (user offline)    | Show error toast, allow retry                         |
| Edge function auth failure      | Redirect to sign-in                                   |

---

## Exercise Count by Duration

| Duration | Exercise Count | Approx Sets |
| -------- | -------------- | ----------- |
| 30 min   | 4-6            | 15-20       |
| 45 min   | 5-7            | 20-25       |
| 60 min   | 6-9            | 25-35       |
