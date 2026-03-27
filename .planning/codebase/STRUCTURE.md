# Structure

## Top-Level Layout

- `.ai/` contains planning and product docs such as PRD, architecture, DB plan, and i18n guidance.
- `.cursor/rules/` contains repo-specific coding rules referenced by `AGENTS.md`.
- `apps/` contains deployable applications. Right now the relevant app is `apps/mobile`.
- `packages/` contains shared workspace packages for linting, TypeScript config, UI, and a placeholder mobile package.
- `supabase/` contains migrations, function code, and local Supabase metadata.
- `docs/` currently holds superpowers-related documentation rather than product runtime code.

## Mobile App Structure

### Routing

- `apps/mobile/app/_layout.tsx` is the root shell.
- `apps/mobile/app/index.tsx` performs redirect logic.
- `apps/mobile/app/(auth)/` groups auth routes.
- `apps/mobile/app/(onboarding)/` groups onboarding steps.
- `apps/mobile/app/(tabs)/` contains the main authenticated tabs.
- Standalone screens like `apps/mobile/app/generate-workout.tsx`, `apps/mobile/app/workout.tsx`, and `apps/mobile/app/workout-summary.tsx` sit at the app root because they are modal/full-screen flows.

### Components

- `apps/mobile/components/ui/` contains lower-level UI elements such as `button.tsx`, `collapsible.tsx`, and icon wrappers.
- `apps/mobile/components/auth/` holds provider-specific sign-in controls.
- `apps/mobile/components/workout/` contains workout-session-specific UI.
- `apps/mobile/components/exercise-picker/` contains picker/search/filter UI.
- General-purpose shared components live directly in `apps/mobile/components/`, for example `ambient-glow.tsx` and `themed-text.tsx`.

### Hooks

- Query hooks live in `apps/mobile/hooks/use-workout-queries.ts`, `apps/mobile/hooks/use-profile-query.ts`, and similar files.
- Mutation hooks live in files like `apps/mobile/hooks/use-generate-workout.ts`.
- Theme and platform hooks live in `apps/mobile/hooks/use-theme-color.ts`, `apps/mobile/hooks/use-color-scheme.ts`, and `apps/mobile/hooks/use-color-scheme.web.ts`.

### State

- Zustand stores are in `apps/mobile/stores/`.
- Associated unit tests are colocated in `apps/mobile/stores/__tests__/`.

### Domain / Data Utilities

- `apps/mobile/lib/api/` contains persistence and remote-call modules.
- `apps/mobile/lib/schemas/` contains standalone validation schemas.
- `apps/mobile/lib/` also contains cross-cutting utilities like `sync-queue.ts`, `sync-handlers.ts`, `track-event.ts`, and `profanity.ts`.

### Internationalization

- App i18n bootstrap: `apps/mobile/i18n/index.ts`
- Resource registry: `apps/mobile/i18n/resources.ts`
- Namespace files: `apps/mobile/i18n/locales/en/*.ts`

### Design Tokens

- Theme tokens and semantic color sets live in `apps/mobile/constants/theme.ts`.
- Feature-specific constants live in files like `apps/mobile/constants/exercise-filters.ts`.

## Shared Workspace Packages

- `packages/eslint-config/` exports reusable ESLint presets consumed by the app.
- `packages/typescript-config/` exists for shared TS config distribution.
- `packages/ui/src/` contains a small React DOM oriented UI package (`button.tsx`, `card.tsx`, `code.tsx`).
- `packages/mobile-package/` looks like a placeholder package with no meaningful implementation yet.

## Backend Structure

- `supabase/functions/generate-workout/index.ts` is the current Edge Function entry point.
- `supabase/migrations/` contains timestamped SQL migrations.
- `supabase/snippets/` likely stores helper SQL or local development snippets.
- `supabase/data/` and `.temp/` are local Supabase environment artifacts.

## Testing Layout

- App-level screen tests are colocated under route groups, for example `apps/mobile/app/(auth)/__tests__/` and `apps/mobile/app/(onboarding)/__tests__/`.
- Component tests sit beside components, for example `apps/mobile/components/ui/button.test.tsx`.
- Library tests sit under `apps/mobile/lib/__tests__/` and `apps/mobile/lib/api/__tests__/`.
- Global Jest setup is in `apps/mobile/jest.setup.js`.

## Naming And Organization Patterns

- Path alias `@/` is used heavily inside the mobile app, pointing at the app root per `apps/mobile/jest.config.cjs`.
- Stores, hooks, and API modules use descriptive domain-first filenames like `use-workout-queries.ts` or `workout-mappers.ts`.
- Route groups use Expo Router conventions with parenthesized directory names.
- Tests generally follow `*.test.ts` or `*.test.tsx` naming and are often colocated.

## Areas To Read First

- App startup and providers: `apps/mobile/app/_layout.tsx`
- Auth routing and boot flow: `apps/mobile/app/index.tsx`, `apps/mobile/stores/auth-store.ts`
- Workout domain: `apps/mobile/app/generate-workout.tsx`, `apps/mobile/app/workout.tsx`, `apps/mobile/stores/workout-store.ts`, `apps/mobile/lib/api/workouts.ts`
- Backend rules and schema: `supabase/migrations/*.sql`
- AI generation backend: `supabase/functions/generate-workout/index.ts`
