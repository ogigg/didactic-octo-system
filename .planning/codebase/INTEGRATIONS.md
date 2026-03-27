# Integrations

## Primary External Services

### Supabase

- The mobile app creates a Supabase client in `apps/mobile/lib/supabase.ts`.
- Required public environment variables are `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- Supabase Auth sessions persist through AsyncStorage in `apps/mobile/lib/supabase.ts`.
- Data access for app entities flows through Supabase table operations and RPCs in `apps/mobile/lib/api/workouts.ts`, `apps/mobile/lib/api/profiles.ts`, and `apps/mobile/lib/api/exercises.ts`.
- The app also invokes Supabase Edge Functions through `supabase.functions.invoke()` in `apps/mobile/lib/api/ai-workout.ts`.

### Supabase Auth

- Auth state is subscribed to in `apps/mobile/stores/auth-store.ts`.
- Session lifecycle is surfaced through `apps/mobile/hooks/use-auth.ts`.
- Sign-in, sign-up, password reset, and reset-password routes live under `apps/mobile/app/(auth)/`.
- The database auto-creates profile rows using the `handle_new_user` trigger in `supabase/migrations/20260319215622_init_schema.sql`.

### Supabase Database

- `profiles` is defined in `supabase/migrations/20260319215622_init_schema.sql`.
- Workout-related entities are defined in `supabase/migrations/20260322000000_add_workout_tables.sql`.
- The workout API layer uses tables `workout_sessions`, `session_exercises`, `session_sets`, and `set_logs` from `apps/mobile/lib/api/workouts.ts`.
- A detail read path uses the RPC `get_workout_session_detail` from `apps/mobile/lib/api/workouts.ts`.
- RLS policies are implemented in the migration files and appear central to the security model.

## AI / LLM Integration

### OpenRouter

- The Edge Function in `supabase/functions/generate-workout/index.ts` targets `https://openrouter.ai/api/v1/chat/completions`.
- The configured model constant is `anthropic/claude-3.5-sonnet`.
- The function validates request and response payloads with Zod before returning to the client.
- Fallback generation paths are encoded through `generation_source` values `llm`, `fallback_template`, and `fallback_substitution`.
- The app-side consumer parses the function response with `generateWorkoutResponseSchema` in `apps/mobile/lib/api/ai-workout.ts`.

### Workout Generation Flow

- UI entry point: `apps/mobile/app/generate-workout.tsx`
- React Query mutation hook: `apps/mobile/hooks/use-generate-workout.ts`
- API client wrapper: `apps/mobile/lib/api/ai-workout.ts`
- Edge Function implementation: `supabase/functions/generate-workout/index.ts`
- Persisted workout execution path: `apps/mobile/lib/sync-handlers.ts` + `apps/mobile/lib/api/workouts.ts`

## Expo / Native Integrations

### Expo Router

- Registered as a plugin in `apps/mobile/app.json`.
- Main route graph is declared by filesystem structure under `apps/mobile/app/`.

### Apple Authentication

- Enabled as an Expo plugin in `apps/mobile/app.json`.
- UI wrapper component exists at `apps/mobile/components/auth/apple-sign-in-button.tsx`.

### Auth Session / Web Browser

- `expo-auth-session` and `expo-web-browser` are present in `apps/mobile/package.json`.
- Google sign-in UI appears scaffolded via `apps/mobile/components/auth/google-sign-in-button.tsx`.
- The actual production auth-provider wiring should be verified before depending on it.

### Localization

- Plugin registration: `apps/mobile/app.json`
- Runtime initialization: `apps/mobile/i18n/index.ts`
- Namespace registry: `apps/mobile/i18n/resources.ts`

### Network And Lifecycle

- Online/offline sync queue retries are triggered by NetInfo in `apps/mobile/app/_layout.tsx`.
- App foreground/background auth refresh is tied to `AppState` in `apps/mobile/lib/supabase.ts`.

## Internal Package Integrations

- `apps/mobile/eslint.config.js` consumes `@repo/eslint-config/react-native`.
- `packages/ui` exports React components from `packages/ui/src`, but the mobile app currently imports local components from `apps/mobile/components/` instead.
- `mobile-package` is referenced as a dependency in `apps/mobile/package.json`, but its package file in `packages/mobile-package/package.json` suggests it is currently a placeholder.

## Data Contracts And Validation Boundaries

- Onboarding payload mapping is enforced in `apps/mobile/lib/api/profiles.ts`.
- Auth input validation lives in `apps/mobile/lib/schemas/auth.ts`.
- Workout read/write shapes are guarded in `apps/mobile/lib/api/workouts.ts`.
- LLM output validation happens both in the Edge Function and again in the client wrapper `apps/mobile/lib/api/ai-workout.ts`.

## Security-Relevant Integration Notes

- No secrets were found in the inspected source files; runtime configuration is environment-based.
- The mobile client uses the public anonymous Supabase key, so sensitive business logic must stay server-side.
- Database authorization relies on RLS rather than client-side filtering.
- The Edge Function talks to OpenRouter and therefore needs secret management outside the mobile app.
