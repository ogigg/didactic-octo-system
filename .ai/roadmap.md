# MVP Ticket Roadmap

> **Document status:** Reference document
> **Purpose:** Track the historical MVP delivery plan and capture current post-MVP priority themes at a high level.
> **Last reviewed:** 2026-04-11

## Context

**MVP status:** The full loop is implemented: auth → onboarding → training setup → AI generation → logger → post-workout summary → analytics, with RLS, offline sync, and PostHog. The ticket list below is the historical plan that delivered that scope.

**PRD note:** Exercise data lives in the Supabase `exercises` table rather than an external MCP feed; behavior matches the intent (curated, queryable exercise catalog).

---

## Post-MVP — prioritized themes

These are ordered by **impact vs. leverage on what already exists** (`set_logs`, exercises media fields, Edge Functions, i18n).

| Priority  | Theme                                   | Why now                                                                                                                                       |
| --------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **P1**    | **Progress charts & trends**            | Strength per exercise, weekly volume/tonnage over time — `set_logs` already holds the series; mostly presentation + queries.                  |
| **P1**    | **Exercise instruction library**        | Surface `instructions`, `image_url`, `video_url` on exercise detail — high UX value, minimal schema work.                                     |
| **P2**    | **Workout templates & favorites**       | Save a generated workout to re-run; favorite exercises so generation can bias toward them — strong retention.                                 |
| **P2**    | **lb/kg toggle & more locales**         | i18n infrastructure exists; unit preference affects copy and inputs everywhere weights appear.                                                |
| **P3**    | **AI coach chat**                       | Same LLM pipeline, new surface — “why this exercise?”, “what should I focus on?” with session/history context. Larger product + cost surface. |
| **P3**    | **Consistency / streaks (private)**     | Lightweight accountability without full social; pairs well with analytics.                                                                    |
| **Later** | **Superset & circuit support**          | Great for gym efficiency; requires workout model + logger + AI output shape changes.                                                          |
| **Later** | **Deload week intelligence**            | Signals from RPE, reps, feedback — needs reliable heuristics and UX for “planned easy week”.                                                  |
| **Later** | **Body measurements & progress photos** | Profile already hints (“Measures”); needs storage, privacy, and UI scope.                                                                     |
| **Later** | **Social & sharing**                    | Share summaries / groups — policy, moderation, and positioning beyond MVP’s “no sharing”.                                                     |
| **Later** | **Wearables (HealthKit / Google Fit)**  | HR export, calories — platform APIs and background behavior; can inform intensity later.                                                      |

---

## Historical MVP phases (reference)

The app had a working onboarding flow, tab navigation with mock data, a design system, and i18n — then this roadmap covered backend, auth, and the full workout loop below.

---

## Phase 0 — Backend Foundation

| #    | Title                          | Description                                                                                                                                                                                                            | Deps |
| ---- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| T-01 | **Deploy database schema**     | Run the database migrations to create the core schema: ENUM types, profile and workout tables, indexes, triggers, and RLS policies. Historical planning context now lives in `db-schema.md` and the migration history. | —    |
| T-02 | **Create RLS policies**        | Apply all Row-Level Security policies: profiles own-row, exercises public-read, all workout tables owner-only via `auth.uid()`.                                                                                        | T-01 |
| T-03 | **Seed exercise database**     | Populate `exercises` table with 100–1000+ entries (ExerciseDB/WGER source). Standardize equipment names and muscle groups.                                                                                             | T-01 |
| T-04 | **Initialize Supabase client** | Create `lib/supabase.ts` with env vars and AsyncStorage as auth persistence adapter. Add `.env` to `.gitignore`.                                                                                                       | —    |

> T-01–T-03 (backend) and T-04 (client) can run **in parallel**.

---

## Phase 1 — Authentication

| #    | Title                               | Description                                                                                                                        | Deps       |
| ---- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| T-05 | **Email sign-up / sign-in screens** | Build `(auth)/sign-in.tsx` and `(auth)/sign-up.tsx` with React Hook Form + Zod. Call Supabase auth methods. Show inline errors.    | T-04       |
| T-06 | **Apple Sign-In**                   | Integrate `expo-apple-authentication` + `signInWithIdToken`. iOS only.                                                             | T-04       |
| T-07 | **Google Sign-In**                  | Integrate `expo-auth-session` + `signInWithIdToken`.                                                                               | T-04       |
| T-08 | **Password reset flow**             | "Forgot password?" screen calling `resetPasswordForEmail`. Handle deep link callback.                                              | T-05       |
| T-09 | **Auth-aware root routing**         | Listen to `onAuthStateChange` in root layout. Route: unauthenticated → `(auth)`, not onboarded → `(onboarding)`, ready → `(tabs)`. | T-04, T-05 |
| T-10 | **Logout**                          | Add logout button to Profile tab. Clear local stores, redirect to sign-in.                                                         | T-09       |

---

## Phase 2 — Data Layer & Profile Sync

| #    | Title                                 | Description                                                                                                                                              | Deps             |
| ---- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| T-11 | **TanStack Query provider**           | Wrap app in `QueryClientProvider`. Configure defaults. Create `lib/query-client.ts`.                                                                     | T-04             |
| T-12 | **Sync onboarding to profiles table** | After onboarding completes, upsert gender/goal/frequency to `profiles`. Queue for retry on failure.                                                      | T-02, T-09, T-11 |
| T-13 | **Offline sync queue**                | Build generic `SyncQueue` utility (AsyncStorage-backed) with exponential backoff retry, deduplication by record ID, and last-write-wins on `updated_at`. | T-04             |

> T-13 has no blockers beyond T-04 and can be built early alongside Phase 1.

---

## Phase 3 — AI Workout Generation

| #    | Title                                  | Description                                                                                                                                                                                                                           | Deps       |
| ---- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| T-14 | `**generate-workout` Edge Function\*\* | Deno function that fetches profile + last 3 sessions, builds prompt with exercise IDs, calls OpenRouter (Claude 3.5 Sonnet primary, GPT-4o fallback), validates response, inserts workout_session + session_exercises + session_sets. | T-02, T-03 |
| T-15 | **LLM response Zod validation**        | Define `WorkoutPlanSchema` validating exercise IDs exist in DB, positive load/reps/rest, contiguous order. Add substitution logic for invalid exercises.                                                                              | T-03       |
| T-16 | **Fallback templates**                 | Rule-based workout templates per goal (push/pull/legs, circuit, full-body). Used when both LLMs fail or regeneration limit hit.                                                                                                       | T-03       |
| T-17 | **Rate limiting & cost controls**      | 10 req/min per user, 1 AI generation per 30 min. Max 2 regenerations per session. Log cost metadata.                                                                                                                                  | T-14       |
| T-18 | **Client-side generation hook**        | `useGenerateWorkout` mutation calling Edge Function via `supabase.functions.invoke()`. Loading skeleton, error handling, retry UI. Wire "Start Workout" button.                                                                       | T-11, T-14 |

> T-15 and T-16 can be built **in parallel** with T-14.

---

## Phase 4 — Workout Logger

| #    | Title                                | Description                                                                                                                               | Deps                |
| ---- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| T-19 | **Workout session Zustand store**    | Active workout state: exercises, sets, values, completion, feedback, timer. AsyncStorage persistence. Resume/discard support.             | — (can start early) |
| T-20 | **Logger screen & exercise tiles**   | Vertical ScrollView of exercise cards with set table: set #, previous performance, suggested kg/reps, actual inputs, completion checkbox. | T-18, T-19          |
| T-21 | **Set completion & locking**         | Checkbox validates inputs, marks set complete, locks row. Triggers rest timer.                                                            | T-20                |
| T-22 | **Difficulty feedback**              | Segmented control per exercise: Too Easy / OK / Too Hard. Syncs to `session_exercises`.                                                   | T-20                |
| T-23 | **Rest timer**                       | Auto-starts on set completion. Pause/resume. Reanimated countdown. Persists through backgrounding.                                        | T-21                |
| T-24 | **Session resume/discard on launch** | Modal on app open if active session exists: "Resume workout?" or "Discard".                                                               | T-19, T-20          |
| T-25 | **Sync set logs to Supabase**        | Write `set_logs` on completion via sync queue. Batch-sync remaining data on workout finish. Client-generated UUIDs for offline dedup.     | T-13, T-21          |

> T-19 can be built early alongside Phase 1–2.

---

## Phase 5 — Post-Workout Summary

| #    | Title                                | Description                                                                                                        | Deps |
| ---- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ---- |
| T-26 | **Summary screen**                   | Show total duration, total tonnage (load × reps), fun tonnage comparison, primary muscle groups. Encouraging tone. | T-25 |
| T-27 | **Summary persistence & navigation** | Save summary, navigate to home, clear active session. Next open triggers new generation.                           | T-26 |

---

## Phase 6 — Real Data on Existing Screens

| #    | Title                             | Description                                                                                                                  | Deps       |
| ---- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------- |
| T-28 | **Home screen with live data**    | Replace mocks with TanStack Query hooks: active/next session, weekly completion count. "Generate Workout" CTA if no session. | T-11, T-18 |
| T-29 | **Calendar with workout history** | Query `workout_sessions` for visible months. Show completion indicators. Tap day for mini-summary.                           | T-11, T-25 |

---

## Phase 7 — Analytics & Polish

| #    | Title                     | Description                                                                                                                                                                | Deps       |
| ---- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| T-30 | **Wire analytics events** | Connect `trackEvent` to a real provider (PostHog/Amplitude). Fire: `onboarding_completed`, `workout_generated`, `workout_completed`, `session_duration`, `feedback_given`. | T-12, T-25 |
| T-31 | **Error & empty states**  | Audit all screens for network failures, empty history, expired sessions. Add consistent error UI with retry.                                                               | T-28, T-29 |
| T-32 | **Accessibility audit**   | Test with VoiceOver/TalkBack. Fix roles, labels, focus order, contrast ratios.                                                                                             | T-20, T-26 |

---

## Critical Path

```
T-01 → T-02 → T-03 → T-14 ─┐
                              ├→ T-18 → T-20 → T-21 → T-25 → T-26
T-04 → T-05 → T-09 → T-11 ─┘
```

**12 tickets** on the longest chain. Backend schema and client auth run in parallel and converge at T-18 (client generation hook).

## Parallelism Opportunities

- **T-01–T-03** (backend) parallel with **T-04–T-07** (client auth)
- **T-13** (sync queue) and **T-19** (session store) have no blockers — start early
- **T-15, T-16** (validation + fallback) parallel with **T-14** (Edge Function)
- **T-06, T-07** (Apple/Google auth) independent of each other
