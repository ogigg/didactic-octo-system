# Testing

## Test Stack

- Jest is the unit/integration test runner via `apps/mobile/jest.config.cjs`.
- The preset is `jest-expo`, which matches the Expo React Native runtime.
- React Native Testing Library is included through `@testing-library/react-native` in `apps/mobile/package.json`.
- Jest Native matchers are added through `@testing-library/jest-native/extend-expect` in `apps/mobile/jest.config.cjs`.

## Global Test Setup

- `apps/mobile/jest.setup.js` mocks `expo-constants` and `expo-localization`.
- The same setup file suppresses console warnings and errors by replacing `global.console.warn` and `global.console.error` with Jest fakes.
- Module aliasing for `@/` is configured in `apps/mobile/jest.config.cjs`.
- Zustand middleware mocking is configured via `moduleNameMapper` for `zustand/middleware`.

## Test Discovery

- Jest looks for `**/__tests__/**/*.test.{ts,tsx}` and `**/*.test.{ts,tsx}`.
- Coverage collection includes `**/*.{ts,tsx}` with common Expo/layout exclusions.
- Test files are colocated with domains and components rather than centralized.

## Current Coverage Areas

### Auth / Onboarding Screens

- `apps/mobile/app/(auth)/__tests__/sign-in.test.tsx`
- `apps/mobile/app/(auth)/__tests__/sign-up.test.tsx`
- `apps/mobile/app/(auth)/__tests__/forgot-password.test.tsx`
- `apps/mobile/app/(onboarding)/__tests__/gender.test.tsx`
- `apps/mobile/app/(onboarding)/__tests__/goal.test.tsx`
- `apps/mobile/app/(onboarding)/__tests__/frequency.test.tsx`
- `apps/mobile/app/(onboarding)/__tests__/review.test.tsx`

### Components

- `apps/mobile/components/ui/button.test.tsx`
- `apps/mobile/components/themed-text.test.tsx`
- `apps/mobile/components/ambient-glow.test.tsx`

### Libraries And State

- `apps/mobile/lib/__tests__/profanity.test.ts`
- `apps/mobile/lib/__tests__/sync-queue.test.ts`
- `apps/mobile/lib/__tests__/track-event.test.ts`
- `apps/mobile/lib/api/__tests__/profiles.test.ts`
- `apps/mobile/lib/api/__tests__/exercises.test.ts`
- `apps/mobile/lib/api/__tests__/workouts.test.ts`
- `apps/mobile/lib/api/__tests__/workout-mappers.test.ts`
- `apps/mobile/lib/schemas/__tests__/auth.test.ts`
- `apps/mobile/stores/__tests__/auth-store.test.ts`
- `apps/mobile/stores/__tests__/onboarding-store.test.ts`

## Testing Style

- Repo guidance in `AGENTS.md` explicitly prefers accessibility roles and labels over test IDs.
- The presence of screen-level tests suggests a behavior-oriented style rather than purely isolated shallow tests.
- Utility and API mapping functions are tested independently in `apps/mobile/lib/api/__tests__/` and `apps/mobile/lib/__tests__/`.
- There is no evidence of end-to-end mobile automation in the inspected files.

## Gaps And Risks

- The live workout flow in `apps/mobile/app/workout.tsx` appears complex but has no obvious colocated test file.
- `apps/mobile/app/generate-workout.tsx` also appears central and currently has no visible direct test.
- The Supabase Edge Function in `supabase/functions/generate-workout/index.ts` has no colocated tests in this repository snapshot.
- SQL migrations are not backed by schema assertion tests here.
- Shared package `packages/ui` has no visible test suite.

## Mocking Patterns

- External Expo modules are mocked globally in `apps/mobile/jest.setup.js`.
- Some persistence-related behavior is likely mocked indirectly through the Zustand middleware alias.
- Supabase interactions are tested at the API-wrapper level rather than through a full local backend integration harness, based on the visible file layout.

## Running Tests

- Full workspace tests: `npm run test`
- Mobile app tests: from `apps/mobile`, `npm test`
- Watch mode: from `apps/mobile`, `npm run test:watch`
- Coverage: from `apps/mobile`, `npm run test:coverage`
- Single test file: from `apps/mobile`, `npx jest path/to/test.test.tsx`

## Practical Guidance

- When changing app routes, add or update colocated route tests where possible.
- When changing Zod contracts or Supabase mappings, add focused tests in `apps/mobile/lib/api/__tests__/` or `apps/mobile/lib/schemas/__tests__/`.
- When changing persisted stores, verify hydration and reset paths, not just happy-path mutations.
- Be cautious with the global console suppression in `apps/mobile/jest.setup.js`; it can hide useful warning signals during failures.
