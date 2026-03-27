# Conventions

## TypeScript And Data Modeling

- The repo guidance in `AGENTS.md` says to prefer `interface` over `type` aliases, avoid `enum`, and keep strict typing without `any`.
- In practice, the codebase follows the no-enum rule through const maps such as `WORKOUT_STATUSES` in `apps/mobile/lib/api/workouts.ts` and `FOCUS_AREAS` in `apps/mobile/lib/api/ai-workout.ts`.
- Zod is used as the preferred external-data validation layer in `apps/mobile/lib/api/workouts.ts`, `apps/mobile/lib/api/ai-workout.ts`, `apps/mobile/lib/api/profiles.ts`, and `supabase/functions/generate-workout/index.ts`.
- Domain types are frequently colocated near state or API modules, for example `WorkoutExercise` and `WorkoutSummary` in `apps/mobile/stores/workout-store.ts`.

## React / React Native Style

- Components are functional components only.
- Styling is done through `StyleSheet.create()` in files such as `apps/mobile/app/_layout.tsx`, `apps/mobile/app/workout.tsx`, and `apps/mobile/components/ui/button.tsx`.
- Semantic theme values are pulled through `useThemeColor()` and token maps from `apps/mobile/constants/theme.ts`.
- Accessibility roles and labels are used consistently on interactive controls, for example `apps/mobile/components/ui/button.tsx` and `apps/mobile/app/generate-workout.tsx`.
- Screens typically import translation hooks rather than hardcoding UI strings, for example `apps/mobile/app/_layout.tsx`, `apps/mobile/app/workout.tsx`, and `apps/mobile/app/generate-workout.tsx`.

## State Management Patterns

- Zustand stores bundle state and actions in a single factory module.
- Persisted stores use `persist` plus `createJSONStorage(() => AsyncStorage)` as shown in `apps/mobile/stores/onboarding-store.ts` and `apps/mobile/stores/workout-store.ts`.
- Store actions are mostly imperative and side-effect aware, for example `signOut()` in `apps/mobile/stores/auth-store.ts`.
- TanStack Query is reserved for server state, while Zustand owns transient and session-local UI state.

## API Layer Patterns

- Supabase access is wrapped behind functions in `apps/mobile/lib/api/` rather than being called ad hoc from screens.
- Auth checks are enforced close to data operations, for example `getAuthenticatedUserId()` in `apps/mobile/lib/api/workouts.ts`.
- API modules parse responses immediately after fetching, reducing unchecked data flow deeper into the app.
- Edge Function invocations are wrapped in dedicated helpers such as `generateWorkout()` in `apps/mobile/lib/api/ai-workout.ts`.

## Error Handling

- Most API wrappers throw `Error` objects with backend messages directly.
- There is some domain-specific error shaping, for example `RateLimitError` in `apps/mobile/lib/api/ai-workout.ts`.
- The sync queue swallows handler exceptions and retries with exponential backoff in `apps/mobile/lib/sync-queue.ts`.
- Onboarding store hydration errors are recovered by reset instead of surfacing to users in `apps/mobile/stores/onboarding-store.ts`.

## Testing Conventions

- Testing guidance in `AGENTS.md` prefers accessibility-based querying and user-behavior assertions.
- Jest uses the Expo preset and colocated test files.
- Mocking is lightweight and pragmatic, as shown in `apps/mobile/jest.setup.js`.
- Tests are distributed close to the code they cover rather than centralized in one folder.

## Formatting And Linting

- Prettier rules are centrally defined in `.prettierrc`.
- Semicolons and double quotes are the repo default.
- ESLint ignores generated/build/test paths from `apps/mobile/eslint.config.js`.
- Husky + lint-staged auto-format changed TS/JS/JSON/MD/YAML files on commit from the root `package.json`.

## Naming Patterns

- Hooks start with `use`, stores end with `-store.ts`, API modules are grouped by domain noun.
- i18n namespaces use kebab-case filenames under `apps/mobile/i18n/locales/en/`.
- React Native components use PascalCase exports in camel/kebab filename pairs depending on local style.
- SQL migration files use timestamp prefixes and descriptive suffixes under `supabase/migrations/`.

## Notable Deviations Or Tensions

- The frontend guidance in `AGENTS.md` says not to add `useMemo`/`useCallback` by default, but existing files like `apps/mobile/app/_layout.tsx` and `apps/mobile/app/generate-workout.tsx` do use them.
- The instruction to prefer `interface` is not universal; some union and inferred types are still expressed with `type`, for example `FocusArea` in `apps/mobile/lib/api/ai-workout.ts`.
- `packages/ui/src/button.tsx` follows a web React pattern and does not mirror the React Native conventions used by the main app.

## Practical Rules For Future Work

- Validate anything that crosses a trust boundary with Zod.
- Keep screen components thin when a reusable hook, store action, or API wrapper can hold the logic.
- Follow the existing route-group organization in `apps/mobile/app/` when adding user flows.
- Add user-facing strings to `apps/mobile/i18n/locales/en/` instead of hardcoding them in JSX.
- Preserve the split between server state (TanStack Query) and local/session state (Zustand + AsyncStorage).
