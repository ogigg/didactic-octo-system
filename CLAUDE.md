# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Root (Turborepo)

```bash
npm run dev          # Start all dev servers
npm run build        # Build all packages
npm run lint         # Lint all packages
npm run test         # Run all tests
npm run check-types  # TypeScript type checking
npm run format       # Format all files with Prettier
npm run format:check # Check formatting without writing
```

### Mobile App (`apps/mobile`)

```bash
npx expo start       # Start Expo dev server
npx expo run:ios     # Launch iOS simulator
npx expo run:android # Launch Android emulator
npm test             # Run Jest tests
npm run test:watch   # Run Jest in watch mode
npm run test:coverage # Run Jest with coverage report
```

### Running a single test

```bash
# From apps/mobile
npx jest path/to/test.test.tsx
npx jest --testNamePattern="test name"
```

## Architecture

This is a **Turborepo monorepo** for an AI-powered workout generation mobile app.

### Structure

- `apps/mobile/` — React Native/Expo app (the only app for MVP)
- `packages/ui/` — Shared React component library
- `packages/eslint-config/` — Shared ESLint rules
- `packages/typescript-config/` — Shared TypeScript configs
- `.ai/` — Planning documents (PRD, DB schema, architecture, tech stack)

### Mobile App Architecture

The app uses **Expo Router** (file-based routing) with the following key directories inside `apps/mobile/`:

- `app/` — Route files (Expo Router convention)
- `components/` — Reusable UI components with colocated tests
- `hooks/` — Custom React hooks
- `constants/` — Theme, colors, configuration
- `i18n/` — Internationalization setup (i18next + expo-localization)

### Data Flow

```
User Action → Component → TanStack Query → Supabase Client → PostgreSQL / Edge Functions → OpenRouter LLM
                                                ↓
                                    Zustand (local UI state)
                                    AsyncStorage (offline persistence)
```

**Supabase Edge Functions** (Deno) handle AI orchestration. All LLM outputs (Claude 3.5 Sonnet via OpenRouter) are validated against database constraints before being returned to the client.

### State Management

- **TanStack Query**: Server state, API calls, caching
- **Zustand**: Local UI state
- **AsyncStorage**: Session persistence with queue-based sync and exponential backoff retry for offline-first support

### Database (Supabase/PostgreSQL)

Key tables: `profiles`, `exercises`, `workout_sessions`, `session_exercises`, `session_sets`, `set_logs`. Row-Level Security is enabled on all tables — users can only access their own data via `auth.uid()`. See `.ai/db-plan.md` for full schema.

## Code Conventions

From `.cursor/rules/`:

**TypeScript**

- Use `interface` over `type` aliases
- No `enum` — use const maps instead
- Strict mode enabled; no `any`
- Functional components only (no class components)

**React Native**

- Validate all external data (especially LLM responses) with **Zod**
- Use `StyleSheet.create()` for styles
- Prefer accessibility-first component design
- Animations via React Native Reanimated; gestures via Gesture Handler

**Internationalization (i18next + react-i18next)**

- All user-facing strings live in `i18n/locales/en/`; never hardcode strings in JSX
- Namespace per screen/feature (kebab-case file, camelCase export): `common`, `home`, `explore`, `modal`, `designSystem`
- Key pattern: `section.element` within namespace; cross-namespace: `t("key", { ns: "other" })`
- Use `useTranslation("namespace")` for simple strings; `Trans` component for inline rich text
- See `.ai/i18n.md` for full naming schema and workflow

**Testing (Jest + React Native Testing Library)**

- Query by accessibility roles/labels first, not test IDs or implementation details
- Test user behavior, not implementation
- `jest.config.cjs` uses `jest-expo` preset with custom `transformIgnorePatterns` for RN/Expo modules
- Setup file: `jest.setup.js` (extends jest-native matchers)

## Pre-commit Hooks

Husky runs `lint-staged` on commit, which auto-formats `*.{ts,tsx,js,jsx,json,md,yml,yaml}` with Prettier. Commits will fail if linting errors exist.

## Planning Documents

- `.ai/prd.md` — Full product requirements and MVP scope
- `.ai/architecture.md` — System architecture diagram
- `.ai/db-plan.md` — PostgreSQL schema, indexes, RLS policies
- `.ai/tech-stack.md` — Technology selection rationale
- `.ai/i18n.md` — i18n library stack, key naming schema, and workflow

## Supabase:

To push new migration to supabase use supabase db push --local, the "--local" flag is important!
