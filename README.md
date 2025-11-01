## Workout – AI Trainer (MVP)

[![node](https://img.shields.io/badge/node-%E2%89%A518-%23339933)](https://nodejs.org) [![typescript](https://img.shields.io/badge/TypeScript-5.x-%233178C6)](https://www.typescriptlang.org/) [![build](https://img.shields.io/badge/Monorepo-Turborepo-%23000000)](https://turbo.build/repo) ![status](https://img.shields.io/badge/status-WIP-orange)

AI Trainer helps gym newcomers start training without confusion. It generates a single, adaptive workout session at a time and validates every AI suggestion against a known exercise database and available equipment.

Links: [Product Requirements (PRD)](.ai/prd.md) · [Tech Stack](.ai/tech-stack.md)

### Table of Contents
- [Project name](#project-name)
- [Project description](#project-description)
- [Tech stack](#tech-stack)
- [Getting started locally](#getting-started-locally)
- [Available scripts](#available-scripts)
- [Running ESLint](#running-eslint)
- [Project scope](#project-scope)
- [Project status](#project-status)
- [License](#license)

## Project name

Workout – AI Trainer (MVP)

## Project description

AI-powered single-session workout planning and logging for iOS/Android. The system generates a complete session tailored to the user’s goal, history, level, and available equipment; validates exercises and equipment before display; and provides simple, offline-capable logging plus a motivating summary.

- Platform: React Native with Expo (mobile-first)
- AI orchestration via OpenRouter; strict JSON schema enforced and validated
- Exercise knowledge via MCP; invalid or unavailable exercises are substituted safely
- Offline-first logging with background sync; clear error states and retries

## Tech stack

### Frontend (Mobile)
- React Native, Expo (SDK 52+), Expo Router, TypeScript
- State: TanStack Query (server state), Zustand (local state)
- Forms & validation: React Hook Form, Zod
- UI: React Native Paper (optional), Expo Vector Icons

### Backend
- Supabase (PostgreSQL, Auth, RLS, Realtime, Storage)
- Supabase Edge Functions (Deno): generation, AI orchestration, validation layer

### Database
- PostgreSQL on Supabase: user profiles, exercise library, sessions, logs
- Client: Supabase JS; optional Drizzle ORM

### AI / LLM
- OpenRouter gateway; primary: Claude 3.5 Sonnet, fallback: GPT-4o
- Zod for JSON output validation; optional Langchain later

### Dev, CI/CD, Monitoring
- Code quality: ESLint, Prettier, TypeScript
- Testing: Jest, React Native Testing Library; Playwright (future)
- Deployment: EAS Build/Submit/Update (mobile), Supabase CLI (backend), GitHub Actions
- Monitoring & analytics: Sentry, PostHog, Expo Performance Monitoring

## Getting started locally

### Prerequisites
- Node.js ≥ 18 (20+ recommended), npm (packageManager set to npm@11.4.0)
- Git
- For mobile development (incoming): Xcode/Android Studio, EAS CLI, Expo account
- For backend: Supabase account and Supabase CLI; OpenRouter API key

### Setup
```bash
git clone <your-fork-or-repo-url>
cd workout
npm install
```

### Development
- Monorepo tasks are orchestrated with Turborepo.
- Start all workspace dev tasks:
```bash
npm run dev
```
- Build all workspaces:
```bash
npm run build
```
- Lint and format:
```bash
npm run lint
npm run format
```
- Type-check:
```bash
npm run check-types
```

Notes
- This repository currently includes a Next.js scaffold in `apps/web` and `apps/docs` plus shared UI in `packages/ui`. The React Native/Expo mobile app and Supabase functions will be added per the PRD.
- Environment variables for Supabase and OpenRouter will be documented alongside the mobile and backend packages when introduced.

## Available scripts

From repository root:
- **build**: `turbo run build` — build all apps/packages
- **dev**: `turbo run dev` — run dev tasks across workspaces
- **lint**: `turbo run lint` — lint all workspaces
- **format**: `prettier --write "**/*.{ts,tsx,md}"` — format sources
- **check-types**: `turbo run check-types` — TypeScript checks across workspaces

Workspaces may define additional scripts (see each package's `package.json`).

## Running ESLint

This project uses ESLint 9 with flat config format. ESLint configurations are shared via `@repo/eslint-config` package with workspace-specific configs.

###  Run lint for all workspaces (recommended)

From the repository root:
```bash
npm run lint
```
This uses Turborepo to run the `lint` script across all workspaces in parallel.

## Project scope

MVP focuses on a safe, adaptive single-session planner and lightweight logger:
- Onboarding: gender (optional), goal (preset or custom), weekly frequency; review and submit
- AI session generation: single complete session; inputs include goal, history, level, equipment; strict schema; validation via MCP and availability checks; safe fallbacks; regeneration limit and cost guardrails
- Workout logger: per-exercise tables with suggested kg/reps and previous performance; editable actuals; not-completed state; difficulty feedback (Too Easy/OK/Too Hard); duplicate prevention; auto-start rest timer with pause/resume
- Session management: autosave active session; resume/discard on relaunch; offline logging with queued sync and backoff; conflict resolution via last-write-wins
- Post-workout summary: duration, tonnage, fun comparison, primary muscles; local fallback on errors; encouraging tone
- Non-functional targets: generation ≤ 3s P50/≤ 7s P95; accessibility; privacy/security baselines; analytics for activation and engagement

Out of scope for MVP: monetization, social/sharing, AI chat, instructional media, post-onboarding profile editing, unit switching (kg only), web app.

## Project status

Work in progress (MVP). Monorepo scaffold is present; mobile (Expo) and backend (Supabase Edge Functions) will be added next. Success metrics and detailed user stories are defined in the PRD.

Track details: [PRD](.ai/prd.md) · [Tech Stack](.ai/tech-stack.md)

## License

License not specified yet. Until a `LICENSE` file is added, treat this repository as All Rights Reserved for private evaluation. If you intend to open-source, consider adding MIT/Apache-2.0 and updating this section accordingly.
