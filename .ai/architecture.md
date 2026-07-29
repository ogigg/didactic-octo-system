# Technical Architecture

> **Document status:** Reference document
> **Purpose:** Describe the current system structure, main data flows, and boundary-level technical decisions.
> **Last reviewed:** 2026-04-11

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
- generate workout structure through OpenRouter-backed model calls
- validate generated output before it is trusted
- fail safely when responses are invalid or incomplete

This document intentionally avoids treating specific model names as long-term architecture guarantees because model selection can change faster than the surrounding system.

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
`apps/mobile/targets/watch`. The phone-side Zustand store remains canonical.
The phone sends versioned full snapshots through WatchConnectivity application
context, while the watch sends stable-ID commands through a persistent,
idempotent outbox. Immediate messages improve latency and queued user-info
transfers preserve actions across disconnections. The watch owns HealthKit
collection for watch-led sessions and returns the saved workout UUID so the
phone does not create a duplicate HealthKit workout.

### Workout History Deletion

```text
User confirms permanent deletion from workout detail
-> client removes the workout optimistically from history and calendar caches
-> authenticated database RPC verifies ownership and completed status
-> workout row deletion cascades to exercises, sets, logs, and session comments
-> statistics, progression, streak, and generation caches are invalidated
-> queued or linked platform-health records are cleaned up when supported
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
