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

Store builds are made locally with fastlane; see
[Releasing with fastlane](#releasing-with-fastlane).

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
- Exercise details preview the latest 10 weekly volume (or duration) entries from the trailing 52 weeks, grouped into one bar per week with logged results. Weeks without logged results are omitted. The preview total and weekly average cover only those displayed weeks. The header opens `/exercise-statistics` for the selected exercise. This dedicated screen reuses the overview records and chart, showing all available weekly totals from the trailing 52 weeks in a taller, horizontally scrollable chart, plus live Today progress. Full statistics keeps bars at least 34 points wide and opens at the latest week; totals stay visible while the bars and dates scroll together. Tap a bar for details; hover does not open tooltips in the scrollable chart, so it cannot interrupt horizontal navigation. Its total and average use the full displayed history; personal records remain all-time. The full screen also shows same-weight rep comparisons (or best hold time for timed exercises), average volume/duration across the latest five versus previous five logged sessions, training days in 30/90 days, and days since last performed. Insights use up to 50 recent logged exercise performances, exclude the active workout, and show minimum counts when that limit prevents a complete frequency count. Same-weight comparisons use the heaviest shared load in the nearest earlier matching session; insufficient history shows an explanatory placeholder. Back returns to exercise details. The overall Statistics screen remains separate. Chart bars use a 6-point top-corner radius, with a flat join between completed load and forecast. Historical bars have uniform emphasis until selected. Selecting Today highlights both its completed and forecast portions; selecting a historical week dims Today. All bars have square bottom corners. They add a separate Today bar while the exercise is in the active workout. The Today bar matches the width and blue color of historical bars, without a legend. A blue outline with diagonal hatching shows checked sets; the subtle dashed segment adds the current targets of unchecked sets to the forecast. Edits and check/uncheck actions update it immediately, including offline. The Today tooltip includes completed load, forecast total, and checked/total set counts. Historical totals and weekly averages exclude this in-progress workout; finishing it moves its logged results into history. Chart tooltips float above the bars and close with the X button, an outside tap, or the platform back/escape action.
- Workout history export is available from the History header and through Profile → Account & Data. Users can export completed workouts from the last 7, 30, or 90 days, or all time. JSON and CSV omit internal IDs, generation metadata, planned targets, and other implementation fields; JSON keeps a clean nested training record while CSV provides one row per set. PDF creates a localized training report with summary metrics, a weekly-frequency bar chart, workout-volume line chart, set-completion donut chart, recent workout detail, and all-time strength PRs. The header shows the selected date range. Weekly bars cover up to eight weeks within that range; boundary weeks include only selected workouts. The volume chart and workout table show the latest eight sessions. Volume changes are shown without interpreting them as progress. Reports respect the user's kg/lb preference. Optional duration is included in data exports only for timed exercise results. Files are created in the app cache and handed to the device share menu.
- Pending workout generation is server-owned. Queue reads automatically recover generation rows stuck in `queued`, `generating`, or `regenerating` for more than five minutes through `recover_stale_generation_attempts`, then refetch the authoritative queue. Regeneration failures keep the current plan visible, show a localized error and server reference ID when available, and offer retry when the server marks the error retryable.
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

## Offline save recovery

Failed profile, measurement, and completed-workout writes are retained in the
AsyncStorage-backed sync queue and hydrated even when the app launches offline.
The root layout reflects queued writes as syncing or device-only while offline,
keeps permanently failed items available for an idempotent retry, and offers the
feedback flow with an anonymous diagnostic reference after a repeated failure.
Online enqueues drain immediately, retry at bounded backoff deadlines while the
app is active, and pause scheduled work in the background. Queue records are
versioned so an older in-flight success cannot remove a newer edit; malformed
storage entries are dropped individually without discarding valid or dead work.
A normal successful save does not show status UI.

## Releasing with fastlane

Release builds are made on a local Mac with [fastlane](https://fastlane.tools)
and uploaded straight to App Store Connect and Google Play; EAS is not involved.
The lanes live in [`fastlane/Fastfile`](fastlane/Fastfile) and run from
`apps/mobile`.

### One-time setup

1. Install Xcode and Ruby 3.x with Bundler (Ruby 3.3 via rbenv works), then
   install the pinned fastlane and CocoaPods versions:

   ```bash
   bundle install
   ```

2. Set `export LANG=en_US.UTF-8` in your shell profile. The lanes force UTF-8
   for fastlane and CocoaPods themselves, but fastlane still warns at startup
   without it.
3. Copy [`fastlane/.env.example`](fastlane/.env.example) to `fastlane/.env`
   (git-ignored) and fill in the App Store Connect API key.
4. Put production app config in `.env.production.local` (git-ignored):
   `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`,
   `EXPO_PUBLIC_APP_ENV=production`, the PostHog and Google client IDs. The
   release build inlines these into the JS bundle (EAS used to inject them).
   The lanes stop before building when the Supabase values are missing or
   point at a local server.

### App Store Connect API key

| Variable        | Value                                                                   |
| --------------- | ----------------------------------------------------------------------- |
| `ASC_KEY_ID`    | The key ID shown in App Store Connect.                                  |
| `ASC_ISSUER_ID` | The issuer ID for a team key. Leave it empty for an individual key.     |
| `ASC_KEY_PATH`  | Optional path to the `.p8`. Defaults to `fastlane/AuthKey_<KEY_ID>.p8`. |

Keep the downloaded `.p8` in `fastlane/`; `*.p8` is git-ignored and must never
be committed. The older `fastlane/api-key.json` stored the same key inline:
save its `key` value as the `.p8` file to migrate.

Use a **team key** (Users and Access → Integrations → App Store Connect API →
Team Keys): the lanes download the App Store profiles, read TestFlight build
numbers and upload through it. An individual key (your name → Edit Profile →
Individual API Key) may be refused the profile download.

### iOS signing

The lanes sign only with what team `X6TS5L9ZTL` already has, and they never
create, repair or revoke certificates or profiles: xcodebuild runs without
`-allowProvisioningUpdates`, and profiles are fetched read-only. Before the
native build, the lane:

1. looks up the team's distribution certificate in the login keychain (it needs
   the private key);
2. downloads the existing App Store profiles for `com.ogig.sweaty`,
   `com.ogig.sweaty.SweatyWidget` and `com.ogig.sweaty.SweatyWatch`. Only
   profiles that use the certificate from step 1 are accepted;
3. switches the Release configuration of the generated project to manual
   signing with that certificate and those profiles.

The distribution certificate and profiles were created by EAS (their names
start with `*[expo]`). Apple never hands out a certificate's private key, but
EAS keeps it. Import the certificate once:

1. From `apps/mobile`, run `npx eas-cli credentials -p ios` with an Expo
   account that can access the `ogig` project, choose the `production` build
   profile and download the credentials to `credentials.json`. The
   distribution certificate lands as a `.p12` under `credentials/`, and
   `credentials.json` holds its path and password. Both are git-ignored.
2. Double-click the `.p12` and enter that password to import it into the
   login keychain, then delete `credentials.json` and `credentials/`.

If a lane stops with `No usable App Store profile for <bundle id>`, that bundle
ID has no App Store profile made with the imported certificate. Someone with
access to the developer portal has to create one there (Profiles → App Store
Connect → the bundle ID → the existing distribution certificate). The lane will
not do it for you.

### iOS release commands

```bash
npm run release:ios
```

Runs `fastlane ios beta`. The lane checks the config, sets the build number to
the latest TestFlight build + 1 and regenerates `ios/` when needed. It then
archives a Release build, checks that the IPA contains the watch app and widget
with matching build numbers, and uploads it to TestFlight. Processing on
Apple's side takes 5–30 minutes.

```bash
bundle exec fastlane ios build build_number:42
```

Builds a signed `build/ios/Sweaty.ipa` without uploading it. Without
`build_number:` it keeps the build number already in `ios/`.

Before building, both lanes compare an `@expo/fingerprint` hash of the native
inputs (app config, config plugins, native dependencies, Apple target configs)
with the one saved in `ios/.fastlane-fingerprint`. They skip
`expo prebuild --clean` when nothing changed; pass `clean:true` to force it.
Swift sources under `targets/` are read directly by Xcode and need no prebuild.
The marketing version comes from `app.json` → `version`; bump it when App Store
Connect closes the current version.

### Android setup

The Android lanes build a signed release AAB with Gradle and upload it to the
Play Console internal testing track. They need:

1. **JDK 17.** React Native 0.81's Gradle build does not run on newer JDKs.
   Install it with `brew install openjdk@17`. When `JAVA_HOME` points at
   another version, the lanes switch to the JDK 17 that
   `/usr/libexec/java_home -v 17` finds.
2. **The Android SDK.** `ANDROID_HOME` defaults to Android Studio's
   `~/Library/Android/sdk`.
3. **An upload key.** Generate it once and keep a backup outside the
   repository, because Play accepts only builds signed with it:

   ```bash
   keytool -genkeypair -v -keystore fastlane/sweaty-upload.keystore \
     -alias upload -keyalg RSA -keysize 2048 -validity 10000
   ```

   Copy [`fastlane/keystore.properties.example`](fastlane/keystore.properties.example)
   to `fastlane/keystore.properties` and fill in the passwords. `*.keystore`
   and `keystore.properties` are git-ignored. `SWEATY_UPLOAD_*` env vars
   override the file, for example on CI.
   [`plugins/with-android-release-signing.cjs`](plugins/with-android-release-signing.cjs)
   wires the key into the generated `android/app/build.gradle`. Without a key,
   release builds keep the debug signing, and the lanes refuse to run.

4. **A Google Play service account** with release permissions:
   1. In Google Cloud (the project linked to the Play developer account), create
      a service account and download a JSON key.
   2. In Play Console → Users and permissions, invite the service account's
      email and grant **Release to testing tracks** for Sweaty.
   3. Save the key as `fastlane/google-play-service-account.json`
      (git-ignored), or point `PLAY_JSON_KEY_PATH` at it.

### First Google Play release

Google Play only accepts API uploads once the app exists and has a first
build.

1. Create the app `com.ogig.sweaty` in Play Console.
2. Build the first bundle locally:

   ```bash
   bundle exec fastlane android build version_code:1
   ```

3. Upload `android/app/build/outputs/bundle/release/app-release.aab` by hand
   to the internal testing track. Play Console then enrolls the app in Play App
   Signing: Google keeps the app signing key, and the upload key above stays
   yours.
4. Roll that release out to internal testers, then set
   `PLAY_RELEASE_STATUS=completed` in `fastlane/.env`. Until the app has a
   release, Play accepts only `draft` uploads, which is the lane's default.

After that, from `apps/mobile`:

```bash
npm run release:android
```

This runs `fastlane android beta`. It checks the service account, upload key
and JS config, and sets `versionCode` to the highest code on any Play track +

1. It regenerates `android/` when the native fingerprint changed, builds the
   AAB, confirms it is not debug-signed, and uploads it to internal testing
   without store metadata.
   `bundle exec fastlane android build version_code:<n>` builds without
   uploading. The version code reaches Gradle as `-Psweaty.versionCode`, so the
   generated project is not edited.

The app requires Android 8.0 (API 26) or later: `react-native-health-connect`
needs it, so `expo-build-properties` in `app.json` sets `minSdkVersion: 26`.

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
- Apple Watch preferences are owned by the iPhone and persisted locally for
  that phone/watch pairing. They are not account data and are not sent to
  Supabase. Current settings and their independent revision travel as optional
  additive fields on the workout envelope, which older watch builds ignore.
- Settings-only changes never replace application context or republish a
  workout. They use durable `transferUserInfo`, plus `sendMessage` as a latency
  optimization when the watch is reachable. The phone retains the latest
  pre-delivery settings message until WatchConnectivity accepts it; ordinary
  unreachable, unpaired, or not-installed states do not prevent editing.
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

Apple Watch settings default to a 10-second rest warning, rest-end and
set-completion haptics on, 15-second quick rest adjustments, automatic rest
timer presentation on, staying on the timer when rest ends, skip-rest and
end-workout confirmations on, and live heart rate and previous-performance
context visible. The Watch validates and persists these values independently
from workout state, so completing, cancelling, or clearing a workout does not
erase them.

These preferences control only the companion's app-generated rest/set feedback
and workout presentation. They do not affect phone notifications or sounds,
Digital Crown haptics, watchOS language, weight units, or Watch HealthKit
recording and ownership.

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

## iOS Home Screen and Lock Screen widgets

The WidgetKit extension in `targets/widget` also hosts four static widgets
next to the Live Activity:

| Widget        | Families                                                         | Tap opens                                   |
| ------------- | ---------------------------------------------------------------- | ------------------------------------------- |
| Next workout  | small, medium, large; Lock Screen rectangular, circular, inline  | the workout preview, or the running workout |
| Streak & week | small, medium; Lock Screen circular, rectangular, inline         | the app where it was                        |
| Consistency   | medium (8-week grid), large (12-week grid); Lock Screen circular | history                                     |
| Training time | medium, large; Lock Screen circular                              | statistics                                  |

- `components/home-widgets-host.tsx` is mounted in the root layout (iOS only).
  It checks `WidgetCenter` for placed widgets on launch and on every resume;
  without any it clears the stored snapshot and skips the widget queries.
  With widgets it runs `hooks/use-home-widgets.ts`, which builds a JSON
  snapshot with `lib/home-widgets/build-snapshot.ts` from the queue,
  onboarding state, streak status and two lightweight queries (qualifying
  sessions for 12 weeks, session durations for 8 weeks), then hands it to
  `modules/home-widgets`.
- The module stores the snapshot in the `group.com.ogig.sweaty` App Group under
  `homeWidgets.snapshot.v1` and calls `WidgetCenter.reloadAllTimelines()`.
  Publishing is debounced and skipped when the content has not changed; it is
  retried after a failure and repeated on every resume so the widget recovers
  on its own. Saved exercise edits are validated with Zod, and a snapshot that
  fails to build is skipped rather than breaking the app.
- `lib/query-client.ts` wires TanStack's `focusManager` to `AppState`, so stale
  queries (the widget's included) refetch when the app returns to the
  foreground.
- The contract is `lib/home-widgets/types.ts`, mirrored in
  `targets/widget/Home/HomeWidgetSnapshot.swift`. Bump the version and the
  storage key on both sides for breaking changes; the key is also duplicated in
  `modules/home-widgets/ios/HomeWidgetsModule.swift` and
  `targets/widget/Home/HomeWidgetStore.swift`.
- Widget copy lives in `i18n/locales/{en,pl}/widgets.ts`. The app renders it
  into the snapshot, so plurals and the in-app language apply. Only the widget
  gallery names and descriptions and the "open the app" fallback live in
  `targets/widget/{en,pl}.lproj/Localizable.strings`.
- Dates are local calendar keys with Monday-first weeks. The widget resolves
  today, future days and a newly started week against its timeline date and
  refreshes at local midnight, so the week ring and activity grid stay correct
  while the app is closed.
- Totals that depend on the week (session counts, averages, hours, best week
  and the streak) come precomputed in `summaries`, one per week for the next
  12 weeks, as if nothing new is logged. The widget uses the entry for the
  current week, so the totals keep matching the grid and bars. The projected
  streak follows `get_streak_status`: a missed week breaks it unless a Pro
  freeze covers it automatically, and earned freezes wait for the user.
- An in-progress workout belongs to the account that started it
  (`ownerUserId` in `stores/workout-store.ts`). When a different account signs
  in, `lib/active-workout-owner.ts` cancels it on the Watch and clears it
  before the tabs render, which also ends the Live Activity. The widget only
  shows a workout owned by the signed-in account.
- Signed-out users see a sign-in prompt, and accounts that have not finished
  onboarding see a prompt to finish setup. In those states, and for Streak &
  week, a tap has no deep link and just brings the app forward where it was,
  so it never stacks a second sign-in or home screen.
- Widget and Live Activity links open root-stack screens such as `workout`,
  `workout-preview`, `history` and `statistics`, which sit outside the route
  groups' auth checks. `hooks/use-deep-link-auth-guard.ts`, mounted in the root
  layout, sends signed-out users from any root-stack screen except the public
  ones and the self-guarded `(auth)`, `(tabs)` and `(onboarding)` groups back
  to sign-in. It uses `dismissTo`, so an open sign-in screen is reused. This
  covers a widget that still shows data from before sign-out and a session
  that ends on a settings screen, such as after scheduling account deletion.
- Widget colors come from `targets/widget/expo-target.config.json`
  (`widgetAccent` and `widgetBackground` use `{ "light", "dark" }`); prebuild
  rewrites `targets/widget/Assets.xcassets` from that config.

After changing the widget sources or target configuration, rebuild the
extension with the Live Activity commands above.
