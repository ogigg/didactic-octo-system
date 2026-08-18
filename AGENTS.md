# AGENTS.md

## Source Of Truth

- Use `PROJECT.md` for current product and execution context.
- Start documentation discovery at `docs/README.md`.
- Follow `docs/documentation-guide.md` when creating or updating documentation.
- Use `.ai/prd.md` only as historical MVP background; do not infer current product intent from it.
- Use `.ai/architecture.md` and `.ai/tech-stack.md` for deeper technical context.

## Architecture

- The Expo app lives in `apps/mobile`.
- Expo Router for navigation.
- TanStack Query for server state; Zustand for local UI state.
- AsyncStorage for persistence and offline-oriented flows.
- Supabase for auth, database, and edge functions.
- OpenRouter for LLM-backed workout generation.

## Code Conventions

### TypeScript

- Use `interface` over `type` aliases.
- Do not use `enum`; prefer const maps.

### React Native

- Use `StyleSheet.create()` for styles.
- Use Zod to validate external data, especially AI responses.
- Use React Native Reanimated and Gesture Handler for motion and gestures.
- Follow `docs/style-guide.md` for shared UI patterns and `docs/styles/bottom-sheets.md` for modal and bottom-sheet behavior.

### Internationalization

- All user-facing strings live in `i18n/locales/en/`.
- Do not hardcode user-facing strings in JSX.
- Use `useTranslation()` for simple strings and `Trans` for rich inline content.
- Follow `.ai/i18n.md` for key naming and workflow.

## Working Style

- After every code or behavior change, check whether docs need updates. Update the relevant README, `project-wiki`, `.ai`, or `PROJECT.md` documentation in the same change when the behavior, commands, setup, architecture, database shape, or user-facing workflow changes.
- If you add or materially change important database tables, columns, relationships, or invariants, update `.ai/db-schema.md` in the same change.
- At the end of a task, suggest a few concrete follow-ups if they would improve UX, UI, or code quality.

## Tooling

- If adding Supabase migrations locally, use `supabase db push --local`.

## Git

- When working on a Linear issue, name the branch `ticket-number-short-description` from `remote/master`.
- Create a new branch per programming task. Skip this for conversation-only work.
