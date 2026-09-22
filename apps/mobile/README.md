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
- The Calendar marks protected and ended streak weeks from persisted streak events and qualifying workouts with connected, rounded date bands: very light blue for weeks with a qualifying workout, icy blue with a snowflake for protection, subtle coral for a streak break. Workout dates and calendar week bands use device-local Monday–Sunday boundaries. Persisted protected weeks retain their recorded Monday date labels; the backend streak counter still uses its existing UTC boundaries. Today has an outline even on workout and protected days; the marker, bands, and month range refresh at local midnight and on app resume. The calendar starts on Monday; bands have no bottom border and end at week and row boundaries. Development builds also show next week as an ended streak preview, including its month when the preview crosses a month boundary. Set `MOCK_NEXT_WEEK_AS_RUINED` to `false` in `lib/streak-calendar.ts` to disable this local-only preview; it never writes to the database. The same preview flag also shows September 21–27, 2026 as a failed week with a blue freeze marker on September 24 (a visual mock, separate from the weekly protection rules).
- The main navigation uses Expo Router native tabs. iOS 26 builds compiled with Xcode 26 use the system Liquid Glass tab bar; Android uses the native Material bottom navigation.
- Account deletion is available through Profile → Account & Data. Active subscribers are warned before continuing and can open the official Apple or Google Play subscription-management destination; if that destination is unavailable, the app tries the platform's official support page and then shows a localized error.
- Password management is available through Profile → Account & Data. Signed-in OAuth users can add email/password sign-in without replacing their existing identity, while password users can change their password. Secure password changes use provider reauthentication for Apple on iOS and Supabase's email nonce flow otherwise.
- Exercise details show weekly historical volume (or duration) for the trailing 52 weeks, grouped into one bar per week with logged results (no separate client-side item cap). Historical bars have uniform emphasis until selected. They add a separate Today bar while the exercise is in the active workout. The Today bar matches the width and blue color of historical bars, without a legend. Solid blue shows checked sets; the subtle dashed segment adds the current targets of unchecked sets to the forecast. Edits and check/uncheck actions update it immediately, including offline. The Today tooltip includes completed load, forecast total, and checked/total set counts. Historical totals and weekly averages exclude this in-progress workout; finishing it moves its logged results into history. Chart tooltips float above the bars and close with the X button, an outside tap, or the platform back/escape action.
- Workout history export is available from the History header and through Profile → Account & Data. Users can export completed workouts from the last 7, 30, or 90 days, or all time. JSON and CSV omit internal IDs, generation metadata, planned targets, and other implementation fields; JSON keeps a clean nested training record while CSV provides one row per set. PDF creates a localized training report with summary metrics, a weekly-frequency bar chart, workout-volume line chart, set-completion donut chart, recent workout detail, and all-time strength PRs. The header shows the selected date range. Weekly bars cover up to eight weeks within that range; boundary weeks include only selected workouts. The volume chart and workout table show the latest eight sessions. Volume changes are shown without interpreting them as progress. Reports respect the user's kg/lb preference. Optional duration is included in data exports only for timed exercise results. Files are created in the app cache and handed to the device share menu.
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

- The hydrated phone Zustand store is authoritative. Snapshots carry monotonic
  revisions; the watch caches the snapshot and revision together and overlays
  its persisted pending commands until acknowledgment.
- Commands use stable workout, exercise occurrence, set, and rest IDs. The watch
  sends one command at a time through immediate and durable WatchConnectivity
  delivery. The phone serializes application, waits for local persistence, and
  acknowledges duplicates and rejected stale commands as well as accepted ones.
  A canonical snapshot then reconciles the watch's optimistic state.
- Local set edits survive incoming snapshots and relaunch. Logging a set works
  offline, immediately starts rest, and seeds the next set's editor. Rest and
  timed exercise countdowns use deadlines; rest pause/adjust/resume commands
  preserve their original timing across delayed delivery. Local notifications
  alert when a timer expires while the app is suspended (when permitted).
- Snapshots keep planned and logged values separate, include warm-up completion,
  and use kilograms on the wire with the workout's persisted kg/lb display unit.
- Workout completion is queued immediately, independently of Apple Health.
  HealthKit sessions recover by workout identity and retain that identity after
  transient recovery errors so another session cannot overwrite it; saved UUID receipts travel
  through the durable command outbox. The phone retains a per-workout export
  ledger so late success/failure can be handled after the summary is dismissed.
- `targets/watch/Info.plist` enables `workout-processing`. Active HealthKit
  sessions provide workout execution; WatchConnectivity background work gets a
  bounded drain window. watchOS controls delivery and suspension, so the app
  does not rely on a permanent phone connection or artificial keep-alive.
- The [watch interface standard](../../docs/styles/watch-interface.md) defines
  a shared safe-area header and primary action position. Core screens fit the
  SE 2 40 mm at the default text size; lists/details and larger text can scroll.
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

For focused simulator validation from the repository root:

```bash
python3 apps/mobile/scripts/check-watch-coordinator.py
xcodebuild -project apps/mobile/ios/Sweaty.xcodeproj -target SweatyWatch \
  -configuration Debug -sdk watchsimulator CODE_SIGNING_ALLOWED=NO build
```

The coordinator check executes the production state machine with platform
stubs. It covers offline edits, draft reconciliation, rest commands, units,
navigation, reopening sets, and completion. Real HealthKit saving, haptics,
reconnection, and background delivery also need a paired-device check.
Debug-only layout fixtures are documented in the interface standard.

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
- The Dynamic Island uses the app's light/dark blue accent and shows the current
  or next exercise, set target, per-exercise set position, whole-workout set
  progress, session elapsed time, and rest countdown when applicable.
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
