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

## iOS Signing

- The team has one shared Apple Distribution certificate, stored with the App Store profiles in the private match repo `ogigg/sweaty-signing` (see `apps/mobile/README.md` → "iOS signing"). Install it with `bundle exec fastlane ios certs`, which is read-only.
- Never create, renew or revoke Apple certificates or provisioning profiles without the user's explicit OK. That covers `fastlane ios certs_create`, `match` without `readonly`, fastlane `cert`, `-allowProvisioningUpdates` and Xcode's automatic signing. Never run `fastlane match nuke`.
- Never print or paste the App Store Connect key (`.p8`), `MATCH_PASSWORD` or a `.p12`, and never put the key in `fastlane/Matchfile`: fastlane prints its values unmasked.

## Linear

- Work is tracked in the Linear team `Sweaty` (key `SWE`); issue IDs look like `SWE-123`.
- When you start working on a Linear issue, move it to `In Progress` right away, before planning or writing code. This is a standing project rule and needs no extra confirmation.
- In the same update, assign the issue to whoever started the work: Damian Radecki (Linear user `Damrad`) or Oskar Gierszewski. That person is the owner of the Linear account your session is connected to, so pass `assignee: "me"`. If the account is neither of them, or you can't tell who it is, ask before assigning. If the issue was assigned to someone else, reassign it and tell the user.
- Only move an issue forward from `Backlog` or `Todo`. If it is already `In Review`, `Done`, or `Canceled`, leave the status as is and tell the user.
- If Linear is not reachable from your session, ask the user to move the issue to `In Progress` and assign it to themselves manually.

## Git

- When working on a Linear issue, name the branch `ticket-number-short-description` from `remote/main`.
- Create a new branch per programming task. Skip this for conversation-only work.
