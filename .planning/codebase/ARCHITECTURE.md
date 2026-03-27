# Architecture

## High-Level Shape

- This is a monorepo with one primary executable app: the Expo mobile client in `apps/mobile`.
- Shared tooling packages live under `packages/`, but most product logic is colocated inside the mobile app.
- Backend capabilities are split between Supabase Postgres and a Supabase Edge Function.
- The architecture is app-centric rather than service-heavy: the mobile app owns most orchestration and persists directly to Supabase.

## Main Runtime Layers

### Navigation / Screen Layer

- Expo Router route files under `apps/mobile/app/` define the top-level user flows.
- `apps/mobile/app/_layout.tsx` is the composition root for i18n import, auth bootstrap, query client provider, theme provider, sync queue registration, and router stack configuration.
- Route groups encode flow boundaries:
  - `apps/mobile/app/(auth)/` for authentication
  - `apps/mobile/app/(onboarding)/` for profile setup
  - `apps/mobile/app/(tabs)/` for authenticated tab navigation
  - standalone routes such as `apps/mobile/app/generate-workout.tsx`, `apps/mobile/app/workout.tsx`, and `apps/mobile/app/exercise-picker.tsx`

### UI Component Layer

- Reusable visual primitives and feature components live in `apps/mobile/components/`.
- Screen files compose those components instead of embedding all UI inline; `apps/mobile/app/workout.tsx` is a good example with `WorkoutTopBar`, `WorkoutTimer`, `ExerciseCard`, and `RestTimerBar`.
- Theme tokens and semantic colors come from `apps/mobile/constants/theme.ts`.
- Theme resolution is done through `apps/mobile/hooks/use-theme-color.ts`.

### State Layer

- Auth session state: `apps/mobile/stores/auth-store.ts`
- Onboarding progress state: `apps/mobile/stores/onboarding-store.ts`
- Active workout/session editing state: `apps/mobile/stores/workout-store.ts`
- Persistent local state uses Zustand `persist` middleware plus AsyncStorage for onboarding and workout data.

### Data Access Layer

- Server state queries and mutations are wrapped in hooks under `apps/mobile/hooks/`.
- API modules under `apps/mobile/lib/api/` encapsulate Supabase table and function calls.
- Query keys and shared query client config live in `apps/mobile/lib/query-keys.ts` and `apps/mobile/lib/query-client.ts`.
- Zod schemas in API modules act as the trust boundary for remote data.

### Sync / Offline Layer

- `apps/mobile/lib/sync-queue.ts` implements a lightweight operation queue with exponential backoff and a dead-letter state.
- `apps/mobile/lib/sync-handlers.ts` binds operation names to concrete persistence handlers.
- `apps/mobile/app/_layout.tsx` triggers queue processing on app start, network reconnect, and app foreground.
- This design keeps user flows responsive while deferring some persistence work.

### Backend Layer

- Supabase Postgres holds user profiles, exercise library data, workout sessions, sets, and logs.
- SQL migrations in `supabase/migrations/` define types, constraints, indexes, triggers, and RLS.
- AI workout generation is isolated in `supabase/functions/generate-workout/index.ts`.

## Core Data Flow

### Authentication Flow

1. App boot starts in `apps/mobile/app/_layout.tsx`.
2. `useAuthStore.initialize()` in `apps/mobile/stores/auth-store.ts` reads the current session from Supabase and subscribes to auth changes.
3. `apps/mobile/app/index.tsx` redirects based on auth and onboarding completion.
4. Auth route files under `apps/mobile/app/(auth)/` handle credential flows.

### Onboarding Flow

1. User lands in onboarding routes under `apps/mobile/app/(onboarding)/`.
2. Answers are stored locally in `apps/mobile/stores/onboarding-store.ts`.
3. Profile persistence goes through `apps/mobile/lib/api/profiles.ts`.
4. Offline-safe persistence can be queued via the sync system in `apps/mobile/lib/sync-handlers.ts`.

### Workout Generation And Execution Flow

1. `apps/mobile/app/generate-workout.tsx` collects focus area and duration.
2. `apps/mobile/hooks/use-generate-workout.ts` calls `apps/mobile/lib/api/ai-workout.ts`.
3. The mobile client invokes Supabase Edge Function `generate-workout`.
4. `supabase/functions/generate-workout/index.ts` fetches profile/history/catalog context, calls OpenRouter, validates output, and returns a generated plan or fallback.
5. `apps/mobile/lib/api/ai-workout.ts` validates the response and maps generated exercises into local workout-store format.
6. `apps/mobile/stores/workout-store.ts` becomes the source of truth during the live workout.
7. On completion, sync handlers persist the result into normalized workout tables through `apps/mobile/lib/api/workouts.ts`.

## Architectural Patterns

- File-based routing with grouped route trees.
- Feature-folder style components and hooks within the app package.
- Thin client API wrappers around Supabase operations.
- Strong schema validation at external boundaries.
- Local-first state with eventual sync for selected operations.
- Monorepo tooling centralization with product code mostly in one app package.

## Important Entry Points

- App runtime: `apps/mobile/app/_layout.tsx`
- Auth gate / redirect logic: `apps/mobile/app/index.tsx`
- Workout generation screen: `apps/mobile/app/generate-workout.tsx`
- Live workout screen: `apps/mobile/app/workout.tsx`
- Supabase client bootstrap: `apps/mobile/lib/supabase.ts`
- Edge Function backend: `supabase/functions/generate-workout/index.ts`

## Build Order Implications

- Any auth or session changes must account for `apps/mobile/app/_layout.tsx`, `apps/mobile/stores/auth-store.ts`, and auth routes together.
- Any data model change usually spans a migration in `supabase/migrations/`, parsing logic in `apps/mobile/lib/api/`, and UI/store consumers.
- Workout generation changes can cross all layers: route, hook, client API, Edge Function, schema validation, and persistence.
- Offline persistence changes need coordinated updates to `apps/mobile/lib/sync-queue.ts`, `apps/mobile/lib/sync-handlers.ts`, and the mutation callsites.
