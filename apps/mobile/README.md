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
- Account deletion is available through Profile → Account & Data. Active subscribers are warned before continuing and can open the official Apple or Google Play subscription-management destination; if that destination is unavailable, the app tries the platform's official support page and then shows a localized error.
- Deletion does not cancel store billing. After the 14-day grace period, the implemented purge deletes `auth.users` and cascades through user-owned app data in the database. The repository implements no separate legal/security retention archive; Apple or Google purchase and billing records remain governed by those providers.

### Startup splash

The native Expo splash keeps a static kettlebell visible while JavaScript loads.
After the React overlay is laid out, `AnimatedSplash` hides the native surface and
plays the branded exit once authentication initialization finishes. Reduced
motion skips the decorative animation. Validate native splash changes with a
fresh iOS or Android development build because Expo Go and hot reload do not
rebuild launch-screen assets.

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

## Apple Watch companion

The native watchOS 10 companion lives in `targets/watch` and is generated into
the iOS project by `@bacons/apple-targets`. It is not a separate Expo or React
Native application.

- The phone Zustand workout store is authoritative.
- The phone publishes versioned full workout snapshots with
  `WCSession.updateApplicationContext`; reachable watches also receive the same
  snapshot immediately with `sendMessage`.
- Phone discard publishes a `cancelled` terminal snapshot before clearing
  local state so the watch can end its HealthKit workout.
- The watch uses stable workout, exercise-occurrence, and set IDs. Catalog IDs
  remain separate so repeated exercises are independently editable. Mutations
  are persisted in an idempotent command outbox, delivered with `sendMessage`
  and `transferUserInfo`, and removed only after the phone acknowledges them in
  a later snapshot.
- Rest timers use an absolute ISO-8601 end date so reconnects and suspension do
  not reset the countdown.
- A watch-led session owns the HealthKit workout. The resulting HealthKit UUID
  is correlated back to the phone summary, which prevents the phone from
  writing a duplicate workout.
- `targets/watch/Info.plist` enables `workout-processing`, and the SwiftUI scene
  holds watch-connectivity background work until pending transfers drain.
- `expo-target.config.json` sets `icon` to the shared app icon. App Store /
  TestFlight validation requires a watch `AppIcon` asset catalog and
  `CFBundleIconName`; `@bacons/apple-targets` generates both from that config
  during prebuild.

After changing the target config or adding native files, regenerate and build:

```bash
npx expo prebuild -p ios --clean
cd ios && pod install
xcodebuild -workspace Sweaty.xcworkspace -scheme SweatyWatch build
```

The checked-in `targets/watch` directory is the source of truth; generated
`ios` files remain disposable.

For a paired physical Watch, installing the iPhone development build does not
always install its companion immediately. Open the Watch app on the iPhone,
find Sweaty under **Available Apps**, and tap **Install**. If it is not listed,
open `ios/Sweaty.xcworkspace`, select the `SweatyWatch` scheme and the paired
Watch destination, then run it once from Xcode. The phone bridge keeps the
latest workout snapshot queued while the companion is installing.

## iOS Live Activity

Active workouts publish an ActivityKit Live Activity on iOS 16.2 and later.
It appears as a live notification on the Lock Screen and, on supported iPhones,
in the Dynamic Island. The root application layout owns synchronization so the
activity remains visible when the phone locks, the app backgrounds, or the user
navigates away from the workout route. It ends only when the workout store ends
or clears the active session.

- `modules/workout-live-activity` is the Expo bridge that starts, reconciles,
  updates, and ends ActivityKit activities.
- `targets/widget` is the WidgetKit extension for Lock Screen and Dynamic Island
  presentation.
- Interactive set and rest controls require iOS 18; the informational Live
  Activity surfaces remain available from iOS 16.2.
- The app and extension share `group.com.ogig.sweaty` for background-safe widget
  actions.

After changing the native module, ActivityAttributes, widget sources, or target
configuration, regenerate the disposable iOS project and install pods before
building:

```bash
npx expo prebuild -p ios --clean
cd ios && pod install
xcodebuild -project Sweaty.xcodeproj -target SweatyWidget \
  -sdk iphonesimulator -configuration Debug CODE_SIGNING_ALLOWED=NO build
```

Because `SweatyWorkoutAttributes.swift` is compiled independently into the app
and widget targets, its two checked-in copies must remain field-for-field
identical.
