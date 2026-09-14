# Technical Architecture

> **Document status:** Reference document
> **Purpose:** Describe the current system structure, main data flows, and boundary-level technical decisions.
> **Last reviewed:** 2026-08-13

## Scope Of This Document

This file is meant to explain how the system is structured today at a high level.

Use `../PROJECT.md` for product intent. Use this document for technical shape and system boundaries.

## Current Architecture Summary

The app is a mobile-first Expo / React Native client backed by Supabase and an LLM integration layer accessed through OpenRouter.

At a high level:

- the mobile app owns onboarding, workout execution, local interaction state, and resilience for interrupted sessions
- Supabase owns authentication, persistent data, and server-side business logic
- the AI generation pipeline produces workouts from user context and history, then validates the output before it becomes user-facing

## System Diagram

```text
Mobile App (Expo / React Native)
  -> UI, navigation, workout execution, local state, local persistence
  -> Supabase client

Supabase
  -> Auth
  -> Postgres
  -> Edge Functions / server-side orchestration

AI Integration
  -> OpenRouter
  -> model-backed workout generation
  -> validation and safety checks before persistence / display
```

## Main System Boundaries

### Mobile App

The mobile app is responsible for:

- rendering the user experience
- holding local UI state and active-session state
- preserving in-progress workout context
- making authenticated requests to backend services
- keeping in-workout interactions fast and reliable

Key client-side building blocks:

- Expo Router for route structure
- TanStack Query for server-state fetching and caching
- Zustand for local app state
- AsyncStorage for persistence-oriented flows

### Supabase Backend

Supabase is the primary backend surface and is responsible for:

- authentication and session handling
- persistent relational data storage
- row-level data isolation
- server-side workout generation and validation flows

The data model centers on users, workout sessions, exercises, sets, and training history. For exact schema details, use `db-schema.md` and the live database definitions when precision matters.

### AI Generation Layer

The AI layer exists to generate structured workout outputs, not free-form chat by default.

Its responsibilities are:

- receive user context, preferences, and relevant history
- exclude exercises marked `hard_dislike` in `exercise_preferences` from the generation catalog (prompt, fallback template, and substitution paths)
- generate workout structure through OpenRouter-backed model calls
- validate generated output before it is trusted
- fail safely when responses are invalid or incomplete

Load targets follow an "LLM proposes, backend disposes" split. Exercises with
training history get deterministic loads from the progression engine
(`supabase/functions/_shared/progression.ts`). For exercises the user has never
trained, the LLM proposes initial loads and `validateAndCorrectLoads` in
`supabase/functions/_shared/generator.ts` replaces any missing, zero, or
negative working-set load with a deterministic suggestion
(`suggestInitialLoadKg`: similar-exercise history → muscle-matched strength
baseline → equipment-family default, floored per equipment). Warmup sets get
roughly half the working load. Bodyweight-only exercises are left untouched.
The client additionally renders a zero load as an empty input rather than the
literal string "0".

This document intentionally avoids treating specific model names as long-term architecture guarantees because model selection can change faster than the surrounding system.

## Authentication And Onboarding Readiness

Authenticated routes wait for the current account's profile and local draft
hydration before choosing onboarding or home. A profile fetch failure shows a
retry screen rather than treating the account as new. Completed users cannot
re-enter onboarding; password recovery keeps its own route until finished.
Token refresh does not reload or replace the active onboarding draft. Profile
responses from a previous session are discarded. Drafts and queued writes carry
account ownership so switching accounts cannot replay another user's answers.

Onboarding completion writes profile answers and optional baselines in one
transaction. Retrying completion for an already completed profile preserves its
saved preferences. A queued successful save reconciles local completion and
invalidates the profile query. Home prepares the initial queue automatically;
transport failures expose a retry without asking for setup again. Queue
replacement preserves the old workouts until the backend commits a complete
replacement. Initial generation entitlement is consumed only after success.

## Primary Data Flows

### Workout Generation

```text
User opens app
-> app determines whether a workout should be prepared / fetched
-> backend loads relevant profile, preference, and workout-history context
-> generation request is sent through the AI pipeline
-> response is validated against schema and domain constraints
-> valid workout is stored / returned
-> app renders the generated workout
```

### Workout Execution And Logging

```text
User performs workout
-> app records set completion and feedback locally
-> local state updates immediately for responsive UX
-> persistence / sync layer preserves progress
-> backend receives completed workout data
-> future workout generation can use this history
```

### Apple Watch Workout Execution

The watchOS companion is a native SwiftUI target generated from
`apps/mobile/targets/watch`. The phone-side Zustand store remains canonical,
while the watch maintains a persisted local workout projection for disconnected
logging. Snapshot revisions order phone publications; stable workout, exercise
occurrence, set, and rest-cycle IDs identify mutations.

The phone waits for workout-store hydration before consuming commands and waits
for its serialized AsyncStorage writes before acknowledging them. Commands for
existing incomplete sets in the current workout can arrive after unrelated
phone changes. Completed sets require an explicit reopen action. Wire loads are
kilograms; the bridge converts the phone's display-unit values at the boundary.
Planned values are stored separately from editable actual values.

Phone snapshots use WatchConnectivity application context and immediate messages.
The watch persists commands before applying them locally, sends them in order,
and removes them only after acknowledgment. Incoming snapshots are merged with
pending commands and an editor draft. The snapshot and its revision are cached
together, allowing relaunch without waiting for a newer phone publication.
Rest changes use watch-generated cycle IDs and anchored times, so delayed
receipt does not restart a countdown.

HealthKit sessions are bound to workout identity and recoverable after a watch
process restart. Cancellation discards the recording. Ownership means recording
is pending, not that it was saved: the watch persists the saved UUID receipt
before sending it to the phone. The phone retains Health export coordination
across summary dismissal to handle late success or failure without duplicating
a confirmed watch recording.

The SwiftUI scene enables workout background processing and bounds its
WatchConnectivity background drain. Rest alerts are owned by the coordinator,
independent of the visible screen, with a local-notification fallback. The
[watch interface standard](../docs/styles/watch-interface.md) defines shared
navigation, safe-area placement, and compact-screen verification.

### Workout History Deletion

```text
User confirms permanent deletion from workout detail
-> client removes the workout optimistically from history and calendar caches
-> authenticated database RPC verifies ownership and completed status
-> workout row deletion cascades to exercises, sets, logs, and session comments
-> statistics, progression, streak, and generation caches are invalidated
-> queued or linked platform-health records are cleaned up when supported
```

### Account Deletion

```text
User opens Profile → Account & Data (deletion is not a primary profile control)
-> Account & Data distinguishes sign-out, store subscription cancellation, and account deletion
-> active subscribers are warned that deletion does not cancel App Store / Google Play billing
-> Delete Account explains deleted app data, retained store records, and the 14-day grace period
-> user types DELETE, then confirms a second destructive alert
-> client invokes the delete-account edge function (`request_account_deletion`)
-> the session is signed out; signing back in within 14 days cancels the scheduled purge
-> after the grace period, `purge_expired_deletions()` deletes `auth.users` and cascades user-owned app data
```

## Validation And Safety

Validation happens in layers:

- client-side validation for user-entered data
- server-side schema validation for generated workout payloads
- domain validation for exercise identity, structure, and safety-relevant constraints
- database constraints and auth boundaries for persistence integrity

The architecture should prefer conservative, explainable behavior over clever but brittle generation logic.

## Auth And Data Access

Authentication is handled through Supabase Auth.

The important architectural invariant is not a specific sign-in method, but that:

- requests are tied to authenticated user identity
- user data is isolated through row-level security and related backend controls
- session persistence is secure and resilient enough for a mobile app workflow

Sign-in includes a provider-hint step: when a password sign-in fails with invalid
credentials, the client calls the `login-provider-hint` edge function, which
resolves the email's linked OAuth providers and password status through the
`get_login_provider_hint` `SECURITY DEFINER` RPC over `auth.identities`/`auth.users`.
If the account is Apple/Google-only, the sign-in screen shows a provider-specific
hint instead of the generic error. The lookup runs only after a failed password
attempt and is rate-limited per IP inside the edge function, because the
unauthenticated response inherently reveals which provider an email uses (the same
trade-off as common "Continue with SSO" flows).

## Monitoring And Operational Concerns

Important operational concerns include:

- error visibility for client and backend failures
- generation latency and failure-rate tracking
- validation failure visibility for AI output issues
- analytics that help understand activation, completion, and adherence

This document describes the concern areas rather than promising a fixed monitoring stack forever.

## Current Reality Vs Planned Direction

### Current Reality

- mobile app is the primary product surface
- generation, logging, and progression continuity are core architectural concerns
- resilience around interrupted sessions and sync-sensitive flows matters at the product level

### Planned Direction

Likely future architectural evolution may include:

- richer progress visualizations and reporting
- expanded exercise detail or media support
- broader localization and unit handling
- additional training surfaces built on the same workout-history foundation

These are directional possibilities, not commitments.

## What This Document Should Not Be Used For

Do not use this file as:

- the current product source of truth
- a guarantee that every named integration is fully implemented
- a substitute for checking the actual codebase when implementation details matter

### Onboarding questionnaire

The initial flow is goal → equipment → experience → schedule → review. Gender and strength estimates are deferred; strength estimates remain editable in settings. Schedule explicitly collects days (including once weekly) and duration. Muscle gain maps to hypertrophy, fitness to endurance, and custom goals default to strength with an editable approach on review. Optional constraints use `training_custom_prompt`. Existing saved drafts remain account-owned.

Onboarding uses a shared five-step progress bar/counter, visible Back action, scrollable content and persistent primary action. Review edits return to review; saving locks submission and editing, and errors retain all answers.

### Signup and email links

Signup asks for email and one password, supports password reveal/autofill, and exposes the same social providers as sign-in. Confirmation retains the address and offers resend (60-second cooldown), correction, and sign-in. Signup confirmation links restore the session; recovery links set the recovery routing state before session restoration. Expired links display a recovery screen. Hosted Supabase auth must allow `sweaty://` and `sweaty://reset-password`, matching local configuration.

### Onboarding verification and rollout (2026-09-08)

Regression coverage includes profile hydration before routing, account-owned drafts and sync replay, interrupted setup, completion retries, initial queue concurrency, atomic queue replacement, pound-to-kilogram conversion, and email confirmation/recovery links. A resumed custom goal must satisfy the same validation as a newly entered answer, and legacy drafts must explicitly choose duration before review.

Run `npm test --workspace mobile -- --runInBand --silent --forceExit`, `npm run check-types`, and `supabase test db supabase/tests/onboarding-completion.test.sql supabase/tests/strength-baselines.test.sql`. The queue function also passes `deno check supabase/functions/generate-workout-queue/index.ts`.

Deploy migrations before the updated queue edge function and mobile release. Configure the hosted auth redirect allowlist as described above. The initial-queue timestamp backfill recognizes existing ready queues or completed workout history. Without either, a completed profile retains one free initial preparation attempt. Production migrations and hosted authentication settings are not changed by local verification.
