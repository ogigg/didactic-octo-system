# Tech Stack

> **Document status:** Reference document
> **Purpose:** Summarize the technologies currently used in the repository and separate them from optional or future-facing tools.
> **Last reviewed:** 2026-04-11

## How To Read This Document

- `Current stack` means a technology is reflected in the repository or in active project documentation.
- `Optional or future` means it may be useful later, but should not be assumed to be part of the live implementation without verification.

## Current Stack

### Mobile App

- **React Native** - cross-platform mobile framework
- **Expo** - managed app tooling and platform integrations
- **Expo Router** - file-based routing
- **TypeScript** - type safety across the app

### Client State And Data Flow

- **TanStack Query** - server-state fetching and caching
- **Zustand** - lightweight local state management
- **AsyncStorage** - persistence for session-oriented and offline-sensitive flows

### Forms And Validation

- **React Hook Form** - form state handling
- **Zod** - runtime validation, including structured external or AI-driven data

### Backend And Database

- **Supabase** - backend platform for auth, database, and related services
- **PostgreSQL** - primary relational datastore via Supabase
- **Supabase JS Client** - typed client access from the app
- **Supabase Edge Functions** - server-side orchestration and validation logic

### AI Layer

- **OpenRouter** - model access layer for workout generation

Specific model selection can change over time, so it should be treated as operational configuration rather than a stable architectural dependency.

### UI And Mobile Integrations

- **Expo Vector Icons**
- **React Native Reanimated**
- **React Native Gesture Handler**
- **react-i18next** + **i18next** + **expo-localization**

### Quality And Tooling

- **Turborepo** - monorepo task orchestration
- **ESLint** - linting
- **Prettier** - formatting
- **Jest** - test runner
- **React Native Testing Library** - UI behavior testing
- **Husky** + **lint-staged** - pre-commit formatting workflow

### Deployment And Delivery

- **EAS Build / Submit / Update** - mobile delivery workflows
- **GitHub Actions** - CI/CD automation
- **Supabase CLI** - backend and migration workflows

### Analytics And Observability

- **PostHog** - product analytics, mobile error tracking, and the shared
  operational dashboard for generation, sync, and feedback delivery health

Observability tooling may evolve. When precision matters, verify the currently configured providers in the codebase and environment setup.

## Optional Or Future Technologies

These technologies appear in planning docs, as alternatives, or as likely future additions. They should not be treated as active dependencies by default.

- **React Native Paper** - optional UI component layer
- **Drizzle ORM** - possible alternative data-access layer
- **LangChain** - possible future prompt orchestration layer
- **Playwright** - possible future E2E testing addition
- **Additional external exercise data sources** - useful for seeding or enrichment, not assumed to be runtime dependencies

## Environment Notes

- **Node.js** - see the root `package.json` engines field for the required version
- **npm** - current package manager in the repository
- **Deno** - relevant when working with Supabase Edge Functions

## What This Document Should Not Be Used For

Do not use this file as:

- an authoritative dependency lockfile
- proof that a planned tool is already wired into the application
- a replacement for checking `package.json`, app config, or deployment config when implementation accuracy matters
