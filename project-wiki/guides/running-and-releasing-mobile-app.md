# Running And Releasing The Mobile App

This guide covers the day-to-day commands for running the Expo mobile app, the fastlane release lane, and the manual Xcode archive fallback.

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

## Build And Upload To TestFlight

The default release path is the fastlane lane. It prebuilds when needed, sets the
build number, archives, signs, and uploads to TestFlight. From `apps/mobile`:

```bash
npm run release:ios
```

One-time setup (Bundler, the App Store Connect API key, production `.env`
values, and signing requirements) is in
[Releasing with fastlane](../../apps/mobile/README.md#releasing-with-fastlane).

The watch companion must include an app icon. That comes from
`targets/watch/expo-target.config.json` → `icon`. Without it, App Store Connect
rejects the upload with missing `CFBundleIconName` / watch icon errors.

## Archive Manually In Xcode

Use this fallback when you need to inspect signing or the archive by hand. If
Apple target config changed (for example watch icon or entitlements),
regenerate the native project first from `apps/mobile`:

```bash
npx expo prebuild -p ios --clean
cd ios && pod install
```

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
