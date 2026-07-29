# Running And Releasing The Mobile App

This guide covers day-to-day Expo commands, the gated EAS production workflow and the manual Xcode fallback.

## Start The App

Install dependencies from the repository root, then start the mobile workspace:

```bash
npm install
cd apps/mobile
npm run dev
```

Use the Expo CLI prompts to choose the target platform, or run one of the platform-specific commands below.

## Run Development Builds

From `apps/mobile`:

```bash
npx expo run:ios
```

Builds and opens the app in the iOS simulator.

```bash
npx expo run:ios --device
```

Builds and opens the app on a connected physical iPhone.

Common alternatives:

```bash
npm run ios
npm run android
npm run web
```

## Build For App Store

### Gated EAS production build

The GitHub **Production mobile release** workflow is the authoritative automated production entrypoint. Its `analytics-data-quality` job runs in the protected GitHub `production` environment, loads the real EAS `production` environment, validates the expected PostHog project fingerprint/host and analytics manifest, and must pass before the dependent EAS production build starts.

At present, the job intentionally fails closed because the canonical eight-stage analytics contract depends on `SWE-79` and `SWE-81`, both still `Todo`. Do not bypass the gate or treat the four current workout-loop stages as the complete customer journey.

Required protected GitHub production configuration:

- secret `EXPO_TOKEN`
- secret `POSTHOG_EXPECTED_KEY_SHA256`
- variable `POSTHOG_EXPECTED_HOST`

Required EAS `production` environment:

- readable plaintext/sensitive `EXPO_PUBLIC_POSTHOG_KEY`
- readable plaintext/sensitive `EXPO_PUBLIC_POSTHOG_HOST`

Do not use EAS secret visibility for these public client variables; `eas env:exec` cannot read secret-visibility values, so the production gate will classify that setup as a configuration failure.

### Manual Xcode fallback

The manual path does not satisfy the automated analytics release gate. Use it only for local archive diagnostics, not to bypass a blocked production release.

From the repository root, open the iOS workspace in Xcode:

```bash
cd apps/mobile/ios
open Sweaty.xcworkspace
```

Then in Xcode:

1. Select the `Sweaty` app target.
2. Confirm the signing team, bundle identifier, version, and build number.
3. Choose `Product` -> `Clean Build Folder`.
4. Choose a generic iOS device or an eligible connected device as the run destination.
5. Choose `Product` -> `Archive`.
6. When the archive finishes, use the Organizer window to validate and distribute the build to App Store Connect.

Prefer opening `Sweaty.xcworkspace` instead of `Sweaty.xcodeproj` so CocoaPods dependencies are loaded correctly.
