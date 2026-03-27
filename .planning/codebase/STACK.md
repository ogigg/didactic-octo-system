# Stack

## Workspace Overview

- Monorepo managed from `package.json` with npm workspaces for `apps/*` and `packages/*`.
- Turborepo orchestration lives in `turbo.json` and provides shared `build`, `dev`, `lint`, `test`, `check-types`, and formatting tasks.
- The primary product code is the Expo app in `apps/mobile`.
- Supporting workspace packages live in `packages/eslint-config`, `packages/typescript-config`, `packages/ui`, and `packages/mobile-package`.
- Backend infrastructure is currently Supabase-first, with SQL migrations in `supabase/migrations` and an Edge Function in `supabase/functions/generate-workout/index.ts`.

## Languages And Runtime

- TypeScript is the dominant language across app, packages, and Supabase Edge code.
- SQL is used for schema and policy management in `supabase/migrations/20260319215622_init_schema.sql` and `supabase/migrations/20260322000000_add_workout_tables.sql`.
- Node.js `>=18` is required at the workspace level in `package.json`.
- The mobile app is configured as ESM (`"type": "module"`) in `apps/mobile/package.json`.
- Supabase Edge code uses Deno-compatible npm imports in `supabase/functions/generate-workout/index.ts`.

## Frontend Frameworks

- Expo SDK 54 drives the mobile app via `apps/mobile/package.json`.
- React 19 and React Native 0.81 are the UI runtime in `apps/mobile/package.json`.
- Expo Router provides file-based navigation from `apps/mobile/app/_layout.tsx` and route files under `apps/mobile/app/`.
- React Navigation theming is applied in `apps/mobile/app/_layout.tsx`.
- Reanimated and Gesture Handler are part of the UI stack in `apps/mobile/package.json`, with `GestureHandlerRootView` already used in `apps/mobile/app/workout.tsx`.

## State And Data Libraries

- TanStack Query is configured in `apps/mobile/lib/query-client.ts` and provided globally from `apps/mobile/app/_layout.tsx`.
- Zustand stores manage local app state in `apps/mobile/stores/auth-store.ts`, `apps/mobile/stores/onboarding-store.ts`, and `apps/mobile/stores/workout-store.ts`.
- AsyncStorage is used for persistence in `apps/mobile/lib/supabase.ts`, `apps/mobile/stores/onboarding-store.ts`, `apps/mobile/stores/workout-store.ts`, and `apps/mobile/lib/sync-queue.ts`.
- Zod is the main validation layer for API payloads and LLM responses in `apps/mobile/lib/api/workouts.ts`, `apps/mobile/lib/api/ai-workout.ts`, and `supabase/functions/generate-workout/index.ts`.

## Backend And Data Stack

- Supabase JS client is initialized in `apps/mobile/lib/supabase.ts`.
- PostgreSQL schema is maintained through migration files in `supabase/migrations`.
- Row-Level Security policies are defined extensively in both migration files.
- The AI orchestration path is a Supabase Edge Function in `supabase/functions/generate-workout/index.ts`.
- OpenRouter is the external LLM gateway targeted by the Edge Function.

## Internationalization And UI System

- i18next and `react-i18next` are initialized in `apps/mobile/i18n/index.ts`.
- English namespace files live in `apps/mobile/i18n/locales/en/`.
- Shared design tokens are centralized in `apps/mobile/constants/theme.ts`.
- App-specific React Native primitives exist under `apps/mobile/components/`.
- A separate web-oriented shared UI package exists in `packages/ui/src`, but it is currently minimal and not the main UI surface for the mobile product.

## Tooling

- ESLint is configured per app through `apps/mobile/eslint.config.js`, which imports `@repo/eslint-config/react-native`.
- Prettier settings live at the repo root in `.prettierrc`.
- Husky and lint-staged are enabled from the root `package.json`.
- Jest uses `jest-expo` via `apps/mobile/jest.config.cjs`.
- TypeScript workspace configs are distributed through `packages/typescript-config`.

## Notable Dependencies

- Auth and data: `@supabase/supabase-js`
- Server state: `@tanstack/react-query`
- Local state: `zustand`
- Forms: `react-hook-form` and `@hookform/resolvers`
- Localization: `i18next`, `react-i18next`, `expo-localization`
- Native capabilities: `expo-auth-session`, `expo-apple-authentication`, `expo-haptics`, `expo-image`, `expo-linear-gradient`
- Validation: `zod`
- Network awareness: `@react-native-community/netinfo`

## Configuration Hotspots

- Workspace/task orchestration: `turbo.json`
- Root scripts and workspace definitions: `package.json`
- Mobile runtime and plugins: `apps/mobile/app.json`
- Mobile dependency graph: `apps/mobile/package.json`
- Testing rules: `apps/mobile/jest.config.cjs`, `apps/mobile/jest.setup.js`
- Formatting and ignores: `.prettierrc`, `.gitignore`, `apps/mobile/.gitignore`
