## AI Trainer (MVP)

[![Expo SDK 54](https://img.shields.io/badge/Expo%20SDK-54-000?logo=expo&logoColor=fff)](https://docs.expo.dev)
[![React Native 0.81](https://img.shields.io/badge/React%20Native-0.81-61DAFB?logo=react&logoColor=white)](https://reactnative.dev)
[![Node.js ≥ 20](https://img.shields.io/badge/Node.js-%E2%89%A5%2020-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![License](https://img.shields.io/badge/License-TBD-lightgrey.svg)](#license)

Your workout, planned by AI.

## Table of Contents

- [Project description](#project-description)
- [Tech stack](#tech-stack)
- [Getting started locally](#getting-started-locally)
- [Available scripts](#available-scripts)
- [Project scope](#project-scope)
- [Project status](#project-status)
- [License](#license)

## Project description

AI Trainer helps gym newcomers start training without confusion or anxiety. Instead of static plans, it generates one complete workout session at a time and adapts based on the user’s goals, history, and available equipment. The experience focuses on clear execution, simple logging, and a friendly post‑workout summary.

- **Platform**: Mobile-first using React Native/Expo (iOS and Android)
- **Generation**: LLM via OpenRouter with strict JSON schema validation
- **Safety**: All exercises validated against MCP database and equipment constraints; safe local fallbacks
- **Offline-first logging**: Local autosave with background sync and retry
- **Performance targets**: Generation ≤ 3s P50, ≤ 7s P95; smooth scrolling on mid-tier devices

Additional details:

- Product Requirements: [PRD - AI Trainer (MVP)](.ai/prd.md)
- Technology overview: [Tech Stack](.ai/tech-stack.md)

## Tech stack

### Mobile

- **React Native** (0.81) with **Expo** (SDK 54)
- **Expo Router** (file-based navigation)
- **TypeScript**

### State Management

- **TanStack Query (React Query)** for server state
- **Zustand** for local app state

### Forms & Validation

- **React Hook Form**
- **Zod** for runtime validation and LLM JSON schema enforcement

### UI Components

- **Expo Vector Icons**
- (Optional) **React Native Paper**

### Backend & Data

- **Supabase** (Auth, PostgreSQL, RLS, Realtime, Storage)
- **Supabase Edge Functions** (Deno) for LLM orchestration and validation

### AI / LLM

- **OpenRouter** as gateway
- Primary: **Claude 3.5 Sonnet**; Fallback: **GPT‑4o**

### Tooling, QA, and Ops

- **ESLint**, **Prettier**, **TypeScript**
- **Jest** + **React Native Testing Library**
- Monorepo with **Turborepo**
- **EAS Build/Submit/Update** for mobile CI/CD
- **GitHub Actions** for CI
- **Sentry** (errors), **PostHog** (analytics), **Expo Performance Monitoring**

## Getting started locally

### Prerequisites

- Node.js ≥ 20 and npm ≥ 10 (or pnpm)
- iOS: Xcode (for simulators)
- Android: Android Studio (for emulators)
- Expo Go app on a device (optional for quick testing)

### Install and run (mobile app)

Option A — from repo root:

```bash
# from repository root
npm install
cd apps/mobile
npm run dev
```

Option B — only the mobile app:

```bash
cd apps/mobile
npm install
npm run dev
```

Open on a platform:

```bash
# iOS Simulator (macOS only)
npm run ios

# Android Emulator
npm run android

# Web (Expo web)
npm run web
```

### Testing, linting, formatting (mobile)

```bash
# unit tests
npm test
# watch mode
npm run test:watch
# coverage
npm run test:coverage

# lint
npm run lint

# format (Prettier)
npm run format
# format check (CI-friendly)
npm run format:check
```

Environment variables are not required just to run the UI locally. Backend/LLM integration will require configuration (e.g., Supabase and OpenRouter); see the PRD for expected behavior and add env files as those features land.

## Available scripts

### In `apps/mobile`

| Script          | What it does                                           |
| --------------- | ------------------------------------------------------ |
| `dev` / `start` | Launches the Expo development server                   |
| `ios`           | Starts Expo in iOS simulator                           |
| `android`       | Starts Expo in Android emulator                        |
| `web`           | Starts Expo for web                                    |
| `lint`          | Runs ESLint (via Expo config)                          |
| `format`        | Runs Prettier write over repo files                    |
| `format:check`  | Checks formatting without writing                      |
| `test`          | Runs Jest tests                                        |
| `test:watch`    | Runs Jest in watch mode                                |
| `test:coverage` | Runs Jest with coverage                                |
| `reset-project` | Resets Expo project state (`scripts/reset-project.js`) |

### Monorepo tasks (Turborepo)

Defined in `turbo.json`:

- `build` (depends on `^build`), caches outputs
- `lint` (depends on `^lint`)
- `check-types` (depends on `^check-types`)
- `format` and `format:check` (no cache)
- `test` (caches coverage output)
- `dev` (persistent)

Example usage from repository root:

```bash
# run dev for the mobile app
npx turbo run dev --filter=apps/mobile

# run tests across the monorepo
npx turbo run test
```

## Available scripts

From repository root:

- **build**: `turbo run build` — build all apps/packages
- **dev**: `turbo run dev` — run dev tasks across workspaces
- **lint**: `turbo run lint` — lint all workspaces
- **format**: `prettier --write "**/*.{ts,tsx,js,jsx,json,md,yml,yaml}"` — format sources
- **format:check**: `prettier --check "**/*.{ts,tsx,js,jsx,json,md,yml,yaml}"` — check formatting without modifying files
- **check-types**: `turbo run check-types` — TypeScript checks across workspaces
- **test**: `turbo run test` — run tests across all workspaces

Workspaces may define additional scripts (see each package's `package.json`).

## Running ESLint

This project uses ESLint 9 with flat config format. ESLint configurations are shared via `@repo/eslint-config` package with workspace-specific configs.

### Run lint for all workspaces (recommended)

From the repository root:

```bash
npm run lint
```

This uses Turborepo to run the `lint` script across all workspaces in parallel.

## Running Tests

This project uses Jest with `@testing-library/react-native` for unit testing in the mobile app.

### Run tests for all workspaces (recommended)

From the repository root:

```bash
npm run test
```

This uses Turborepo to run the `test` script across all workspaces in parallel.

### Run tests for a specific workspace

You can also run tests directly in a specific workspace:

```bash
# From the mobile app directory
cd apps/mobile
npm test

# Or in watch mode
npm run test:watch

# Or with coverage
npm run test:coverage
```

### Configuration

The mobile app uses `jest-expo` preset, which is configured in `apps/mobile/jest.config.js`. Test files should be named `*.test.ts` or `*.test.tsx` and placed alongside the code they test, or in a `__tests__` directory.

### Writing Tests

See the mobile app README (`apps/mobile/README.md`) for specific guidelines on writing tests for React Native components.

## Running Prettier

This project uses Prettier for consistent code formatting. Prettier is integrated with ESLint via `eslint-config-prettier` to avoid conflicts.

### Configuration

Prettier is configured via `.prettierrc` in the repository root with the following settings:

- **Semicolons**: Enabled
- **Quotes**: Double quotes (single for JSX)
- **Print Width**: 80 characters
- **Tab Width**: 2 spaces
- **Trailing Commas**: ES5 compatible
- **Arrow Parens**: Always include
- **End of Line**: LF (Unix-style)

### Format all files (recommended)

From the repository root:

```bash
npm run format
```

This formats all supported files (`ts`, `tsx`, `js`, `jsx`, `json`, `md`, `yml`, `yaml`) across the entire repository.

### Check formatting without modifying files

Useful for CI/CD pipelines to verify code is properly formatted:

```bash
npm run format:check
```

This will exit with a non-zero code if any files need formatting.

### Format specific files or directories

You can also run Prettier directly on specific paths:

```bash
# Format a specific file
npx prettier --write apps/mobile/app/index.tsx

# Format a directory
npx prettier --write apps/mobile/components/

# Check formatting for a directory
npx prettier --check apps/mobile/
```

### Useful Prettier Options

- `--write` - Format files in-place (default for `format` script)
- `--check` - Check if files are formatted without modifying them
- `--list-different` - List files that would be changed
- `--log-level` - Set log level (`error`, `warn`, `info`, `debug`, `silent`)
- `--cache` - Use Prettier cache for faster subsequent runs
- `--cache-location` - Specify cache file location

### Editor Integration

For the best experience, configure your editor to format on save:

**VS Code**: Add to `.vscode/settings.json`:

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

### Ignored Files

Files and directories in `.prettierignore` are excluded from formatting, including:

- `node_modules`, build outputs, generated files
- Lock files, environment files
- IDE and OS-specific files

### Pre-commit Hook

This project uses [lint-staged](https://github.com/lint-staged/lint-staged) with [husky](https://typicode.github.io/husky/) to automatically format staged files before commits.

When you commit files, the pre-commit hook will:

- Automatically format all staged files matching `*.{ts,tsx,js,jsx,json,md,yml,yaml}` using Prettier
- Re-stage the formatted files so they're included in your commit

This ensures all committed code is consistently formatted without requiring manual formatting steps.

**To bypass the hook** (not recommended):

```bash
git commit --no-verify
```

The hook is automatically set up when you run `npm install` thanks to the `prepare` script. If you clone the repository fresh, run `npm install` to set up the git hooks.

## Project scope

MVP focuses on a safe, adaptive single-session planner and lightweight logger:

- Onboarding: gender (optional), goal (preset or custom), weekly frequency; review and submit
- AI session generation: single complete session; inputs include goal, history, level, equipment; strict schema; validation via MCP and availability checks; safe fallbacks; regeneration limit and cost guardrails
- Workout logger: per-exercise tables with suggested kg/reps and previous performance; editable actuals; not-completed state; difficulty feedback (Too Easy/OK/Too Hard); duplicate prevention; auto-start rest timer with pause/resume
- Session management: autosave active session; resume/discard on relaunch; offline logging with queued sync and backoff; conflict resolution via last-write-wins
- Post-workout summary: duration, tonnage, fun comparison, primary muscles; local fallback on errors; encouraging tone
- Non-functional targets: generation ≤ 3s P50/≤ 7s P95; accessibility; privacy/security baselines; analytics for activation and engagement

Out of scope for MVP: monetization, social/sharing, AI chat, instructional media, post-onboarding profile editing, unit switching (kg only), web app.

## Project scope

### In scope (MVP)

- Minimal onboarding (gender, goal, weekly frequency) with resume on relaunch
- AI session generation: single-session plan with strict JSON schema, validated via MCP and equipment rules; safe fallbacks and regeneration limits
- Workout logger: sets table per exercise, prefilled targets, editable actuals, not-completed flow, duplicate-prevention
- Rest timer: auto-start on set completion, pause/resume, correct restore after app switching
- Session management: autosave, resume/discard unfinished sessions
- Post-workout summary: duration, total tonnage, fun comparison, primary muscle groups
- Offline-capable logging with queued sync and exponential backoff
- Analytics baseline (activation and engagement events)
- Privacy/security baseline (secure token storage, TLS, no PII in logs)

### Out of scope (MVP)

- Monetization, social features, AI chat, instructional media
- Advanced analytics and historical charts
- Post-onboarding profile editing
- Custom modification of AI-generated plans
- Gamification
- Unit switching (kg only)

## Project status

- Status: **MVP in development**
- Mobile scaffold present (Expo Router, RN/TypeScript, testing setup). Backend/LLM orchestration and MCP validation to be integrated per PRD.
- Performance, reliability, and safety guardrails are defined in the PRD and guide implementation.

See the full requirements and acceptance criteria in the [PRD](.ai/prd.md).

## License

TBD. No license has been specified yet. If you are a maintainer, add a `LICENSE` file (e.g., MIT or Apache-2.0) and update this section and the badge accordingly.
