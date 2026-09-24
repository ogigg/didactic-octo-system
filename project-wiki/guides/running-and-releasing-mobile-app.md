# Running And Releasing The Mobile App

This guide covers the day-to-day commands for running the Expo mobile app and the manual Xcode flow for preparing an App Store archive.

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

If Apple target config changed (for example watch icon or entitlements), regenerate the native project first from `apps/mobile`:

```bash
npx expo prebuild -p ios --clean
cd ios && pod install
```

The watch companion must include an app icon. That comes from
`targets/watch/expo-target.config.json` → `icon`. Without it, App Store Connect
rejects the upload with missing `CFBundleIconName` / watch icon errors.

Then open the iOS workspace in Xcode:

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

## Publish To TestFlight Via CLI

For the fully automated, command-line-only flow (xcodebuild archive → export → fastlane pilot upload), see [Publishing to TestFlight via CLI](../../docs/skills/publish-to-testflight.md).
