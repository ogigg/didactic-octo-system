# workout

[![Expo SDK 54](https://img.shields.io/badge/Expo%20SDK-54-000?logo=expo&logoColor=fff)](https://docs.expo.dev)
[![React Native 0.81](https://img.shields.io/badge/React%20Native-0.81-61DAFB?logo=react&logoColor=white)](https://reactnative.dev)
[![Node.js >= 18](https://img.shields.io/badge/Node.js-%3E%3D%2018-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![License](https://img.shields.io/badge/License-TBD-lightgrey.svg)](#license)

Your workout, planned by AI.

`workout` is a mobile-first AI workout app for people across a wide range of training experience. Users define their training preferences once, then open the app and train the workout that has already been generated for them.

The product is currently in `early product expansion` after the MVP phase. The main focus is improving generation quality, in-session execution, workout logging, and progression continuity rather than widening the product surface area arbitrarily.

## Quick Start

```bash
npm install
cd apps/mobile
npm run dev
```

From `apps/mobile`, you can also run:

- `npm run ios`
- `npm run android`
- `npm test`
- `npm run lint`

For native iOS development builds:

```bash
cd apps/mobile
npx expo run:ios
npx expo run:ios --device
```

See `project-wiki/guides/running-and-releasing-mobile-app.md` for the full running and App Store archive guide.

## Repository Structure

- `apps/mobile` - Expo / React Native app
- `packages/ui` - shared UI package
- `packages/eslint-config` - shared ESLint config
- `packages/typescript-config` - shared TypeScript config
- `.ai` - planning and architecture documents

## Doc Map

- `PROJECT.md` - living product and execution context
- `AGENTS.md` - canonical agent-facing working guide
- `docs/README.md` - project documentation hub and arc42 table of contents
- `docs/style-guide.md` - UI standards index
- `docs/documentation-guide.md` - writing and maintenance standards for people and models
- `.ai/README.md` - index of planning and reference docs
- `.ai/prd.md` - historical MVP PRD
- `.ai/architecture.md` - system architecture
- `.ai/db-schema.md` - curated database schema reference
- `.ai/tech-stack.md` - technology overview
- `apps/mobile/README.md` - mobile-specific development guide
- `project-wiki/guides/running-and-releasing-mobile-app.md` - local run commands and App Store archive workflow

## Tech Snapshot

- Mobile app: React Native + Expo + Expo Router
- State: TanStack Query + Zustand
- Validation: React Hook Form + Zod
- Backend: Supabase + Supabase Edge Functions
- AI: OpenRouter
- Tooling: Turborepo, TypeScript, ESLint, Prettier, Jest

## Commands

From the repository root:

```bash
npm run dev
npm run build
npm run lint
npm run check-types
npm run test
npm run format
npm run format:check
```

## License

TBD. No license has been specified yet.
