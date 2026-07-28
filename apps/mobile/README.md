# Mobile App

This workspace contains the Expo / React Native application for `workout`.

## Stack

- Expo SDK 54
- React Native 0.81
- Expo Router
- TypeScript
- TanStack Query
- Zustand
- React Hook Form
- Zod
- Jest + React Native Testing Library

## Getting Started

From the repository root:

```bash
npm install
cd apps/mobile
npm run dev
```

Useful commands:

```bash
npm run ios
npm run android
npm run web
npm run lint
npm test
npm run test:watch
npm run test:coverage
```

Native iOS development builds:

```bash
npx expo run:ios
npx expo run:ios --device
```

- `npx expo run:ios` builds and opens the app in the iOS simulator.
- `npx expo run:ios --device` builds and opens the app on a connected physical iPhone.

For App Store archiving, see `../../project-wiki/guides/running-and-releasing-mobile-app.md`.

## Structure

- `app` - route files and screen entry points
- `components` - reusable UI components
- `hooks` - custom hooks
- `stores` - Zustand stores and local session state
- `constants` - tokens, configuration, and static values
- `i18n` - translation setup and locale files
- `modules` - custom native / Expo modules
- `plugins` - Expo config plugins
- `targets` - Apple target-specific code such as widgets

## Development Notes

- Prefer editing within existing feature patterns instead of introducing parallel abstractions.
- Keep user-facing strings in `i18n/locales/en`.
- Validate external and AI-generated data with Zod before it drives UI behavior.
- Optimize for mobile realities: interrupted sessions, offline-sensitive flows, and fast in-workout interactions.
- The main navigation uses Expo Router native tabs. iOS 26 builds compiled with Xcode 26 use the system Liquid Glass tab bar; Android uses the native Material bottom navigation.

## Testing

- Run all tests with `npm test`.
- Use `npm run test:watch` during focused iteration.
- Place tests alongside the code they cover when practical.
- Prefer behavior-oriented tests using accessibility queries.

## Related Docs

- `../../PROJECT.md` for current product context
- `../../AGENTS.md` for canonical agent guidance
- `../../.ai/architecture.md` for architecture details
- `../../.ai/i18n.md` for translation workflow
- `../../project-wiki/guides/running-and-releasing-mobile-app.md` for running and release commands
