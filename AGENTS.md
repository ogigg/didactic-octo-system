# AGENTS.md

This is the canonical agent-facing guide for this repository.

## Source Of Truth

- Use `PROJECT.md` for current product and execution context.
- Use `.ai/prd.md` only as historical MVP background.
- Use `.ai/architecture.md` and `.ai/tech-stack.md` for deeper technical context.

## Repository Overview

This is a Turborepo monorepo for a mobile-first AI workout app.

- `apps/mobile` - Expo / React Native app
- `packages/ui` - shared UI package
- `packages/eslint-config` - shared ESLint config
- `packages/typescript-config` - shared TypeScript config
- `.ai` - planning and architecture documents

## Product Context

Do not infer product intent from older MVP documents alone.

- The app is in `early product expansion`.
- The target audience spans both newer and experienced gym users.
- The core promise is low-friction workout generation based on user preferences, history, and constraints.
- Favor work that improves generation quality, in-session execution, workout logging, and progression continuity.

## Commands

### Root

```bash
npm run dev
npm run build
npm run lint
npm run test
npm run check-types
npm run format
npm run format:check
```

### Mobile App

```bash
cd apps/mobile
npm run dev
npm run ios
npm run android
npm test
npm run test:watch
npm run test:coverage
npm run lint
```

### Single Test

```bash
cd apps/mobile
npx jest path/to/test.test.tsx
npx jest --testNamePattern="test name"
```

## Architecture Notes

- The mobile app uses Expo Router.
- TanStack Query handles server state.
- Zustand handles local UI state.
- AsyncStorage is used for persistence and offline-oriented flows.
- Supabase handles auth, database, and edge functions.
- OpenRouter is used for LLM-backed workout generation.
- Validate external and AI-generated data before it reaches user-facing flows.

## Code Conventions

### TypeScript

- Use `interface` over `type` aliases.
- Do not use `enum`; prefer const maps.
- Keep strict typing; avoid `any`.
- Use functional components only.

### React Native

- Use `StyleSheet.create()` for styles.
- Prefer accessibility-first component design.
- Use Zod to validate external data, especially AI responses.
- Use React Native Reanimated and Gesture Handler for motion and gestures.

### Internationalization

- All user-facing strings live in `i18n/locales/en/`.
- Do not hardcode user-facing strings in JSX.
- Use `useTranslation()` for simple strings and `Trans` for rich inline content.
- Follow `.ai/i18n.md` for key naming and workflow.

### Testing

- Prefer accessibility queries over implementation details.
- Test user behavior rather than internal implementation.
- The mobile app uses Jest with React Native Testing Library.

## Working Style

- Follow existing patterns before inventing new abstractions.
- Keep changes focused and maintainable.
- Prefer improvements that strengthen the main training loop instead of widening scope by default.
- When product intent is unclear, ask instead of guessing.
- After every code or behavior change, check whether docs need updates. Update the relevant README, `project-wiki`, `.ai`, or `PROJECT.md` documentation in the same change when the behavior, commands, setup, architecture, database shape, or user-facing workflow changes.
- If you add or materially change important database tables, columns, relationships, or invariants, update `.ai/db-schema.md` in the same change.

## Pre-commit And Tooling Notes

- Husky and lint-staged format staged files on commit.
- If adding Supabase migrations locally, use `supabase db push --local`.

### General info

## Git

- When working on linear issue name branch ticket-number-short-description that originates from remote/master branch
- By default create new branch per task unless it's not a programming task just conversation
