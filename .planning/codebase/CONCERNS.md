# Concerns

## High-Priority Technical Risks

### Workout persistence fan-out is chatty and potentially fragile

- `apps/mobile/lib/sync-handlers.ts` persists a completed workout by creating a session, then looping exercise-by-exercise and set-by-set through multiple Supabase calls.
- This increases latency and failure surface for a single logical save.
- Partial completion is possible if one request fails mid-sequence after earlier inserts succeeded.
- If this flow becomes hot, it likely needs batching or a server-side transactional endpoint.

### Offline queue durability is lightweight but not strongly guarded

- `apps/mobile/lib/sync-queue.ts` stores raw JSON blobs in AsyncStorage without schema validation on load.
- `load()` trusts persisted JSON shape completely.
- Failures during queued mutation replay are retried, but there is no visible telemetry, user-facing surfacing, or reconciliation tooling for dead items beyond `getDeadItems()` and `retryDeadItems()`.
- This is workable for MVP scope, but it is a fragile area for production reliability.

### AI generation backend is coupled to a single external model constant

- `supabase/functions/generate-workout/index.ts` hardcodes `anthropic/claude-3.5-sonnet` via OpenRouter.
- There is no visible model selection, provider abstraction, or configuration-driven override in the inspected code.
- Prompt and output behavior changes upstream could directly affect user-visible functionality.
- The function includes fallback paths, but this remains a critical dependency.

### Missing tests around the most complex workout flows

- The complex interactive flows in `apps/mobile/app/generate-workout.tsx` and `apps/mobile/app/workout.tsx` are not visibly covered by tests.
- The Edge Function in `supabase/functions/generate-workout/index.ts` also lacks visible automated coverage.
- These are likely the highest-regression surfaces in the repo.

## Medium-Priority Product / Architecture Concerns

### Shared package boundaries are not fully real yet

- `packages/ui/src/button.tsx` is a web React button unrelated to the React Native app’s component system.
- `packages/mobile-package/package.json` looks like placeholder scaffolding.
- The monorepo has shared-package structure, but product logic is still concentrated in `apps/mobile`.
- Future package extraction work should be based on demonstrated reuse, not the current folder names alone.

### Existing code already drifts from some documented conventions

- `AGENTS.md` says prefer `interface` and avoid default `useMemo`/`useCallback`, but current app code uses both patterns in several places.
- This is not inherently wrong, but it means planning documents should treat repo rules as intent rather than perfect representation of the codebase.

### Analytics is stubbed

- `apps/mobile/lib/track-event.ts` logs to console in development and contains a `TODO` for real analytics provider integration.
- Any roadmap item depending on usage metrics or funnel analysis needs explicit analytics work first.

### Auth-provider surface may be incomplete

- `apps/mobile/package.json` includes Apple Auth and Auth Session libraries.
- UI components exist at `apps/mobile/components/auth/apple-sign-in-button.tsx` and `apps/mobile/components/auth/google-sign-in-button.tsx`.
- The actual end-to-end provider configuration was not evident in the inspected files, so social auth readiness should be treated as unconfirmed.

## Data / Backend Concerns

### RPC dependency requires backend parity

- `apps/mobile/lib/api/workouts.ts` depends on RPC `get_workout_session_detail`.
- That function was not visible in the migration snippets inspected here.
- If local or remote databases drift from app expectations, workout-detail reads will fail.

### Database model is normalized, but client write path is verbose

- The normalized session/session_exercises/session_sets/set_logs model is sound for reporting and history.
- The client-side write path is correspondingly verbose, which increases implementation overhead and makes transactional consistency harder from the mobile client.

## Testing / Tooling Concerns

### Console suppression can hide important test signals

- `apps/mobile/jest.setup.js` replaces `console.warn` and `console.error` globally.
- This reduces test noise but can also obscure warnings that should trigger fixes.

### Turbo build outputs may not fully reflect Expo app artifacts

- `turbo.json` declares `.next/**` outputs for `build`, which is a web-centric default and does not match Expo mobile outputs directly.
- This is not necessarily harmful, but it suggests workspace tooling may still include template defaults that need cleanup.

## Areas To Watch During Planning

- Anything touching workout completion and persistence.
- Any feature that depends on offline safety or retry semantics.
- Changes to Supabase schema or RLS policies.
- Any work that assumes analytics, social auth, or shared packages are already production-ready.
