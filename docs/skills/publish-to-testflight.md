---
name: publish-to-testflight
description: Use when the user asks to publish, upload, or ship the iOS app to TestFlight / App Store Connect (e.g. "publish the app to the app store so I can test it", "upload a new build to TestFlight"). Builds the iOS app locally and uploads it with the fastlane `ios beta` lane.
---

# Publish iOS App to TestFlight

Run the fastlane `ios beta` lane from `apps/mobile`. It builds locally and uploads to TestFlight without EAS. Setup details live in [Releasing with fastlane](../../apps/mobile/README.md#releasing-with-fastlane).

## Prerequisites (verify before starting)

- macOS with Xcode, and `bundle install` already run in `apps/mobile`.
- `apps/mobile/fastlane/.env` sets `ASC_KEY_ID`, plus `ASC_ISSUER_ID` for a team key. The matching `.p8` is at `apps/mobile/fastlane/AuthKey_<ASC_KEY_ID>.p8` or at `ASC_KEY_PATH`. Both files are git-ignored. If they are missing, ask the user to create them. Never commit, print, or paste key contents.
- `apps/mobile/.env.production.local` holds the production `EXPO_PUBLIC_*` values. The lane refuses to build without a hosted HTTPS Supabase URL and anon key.
- The team's existing distribution certificate, with its private key, is in the login keychain. It is the EAS-made `.p12`; see [iOS signing](../../apps/mobile/README.md#ios-signing). Each of `com.ogig.sweaty`, `com.ogig.sweaty.SweatyWidget` and `com.ogig.sweaty.SweatyWatch` has an App Store profile made with that certificate.
- Never create, regenerate or revoke certificates or profiles without the user's explicit consent. That includes running anything with `-allowProvisioningUpdates`, fastlane `cert`, or `match` without `readonly`. The lane itself only reads them.
- The app record `com.ogig.sweaty` exists in App Store Connect, and the version in `app.json` is still open for new builds.

## Steps

1. From `apps/mobile`, run:

   ```bash
   npm run release:ios
   ```

   The lane:
   - validates the config;
   - checks the distribution certificate in the keychain and downloads the existing App Store profiles (read-only);
   - sets the build number to the latest TestFlight build + 1;
   - regenerates `ios/` with `expo prebuild --clean` and `pod install` when the native fingerprint changed;
   - archives and signs a Release build into `build/ios/Sweaty.ipa`;
   - checks that the watch app and widget are embedded with matching build numbers;
   - uploads the IPA to TestFlight.

   Add `clean:true` (`bundle exec fastlane ios beta clean:true`) to force a fresh prebuild.

2. Report back:
   - Tell the user the uploaded build number from the lane output.
   - Say that processing on Apple's side takes 5–30+ minutes, and that testers are notified automatically once it finishes.
   - To check processing, use App Store Connect → TestFlight, or `bundle exec fastlane pilot builds`.

For a signed IPA without uploading, run `bundle exec fastlane ios build build_number:<n>`.

## Troubleshooting

| Error                                                                | Cause / fix                                                                                                                  |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `Set ASC_KEY_ID ...` / `App Store Connect API key not found`         | `fastlane/.env` or the `.p8` is missing. See `fastlane/.env.example`.                                                        |
| `Release JS config is incomplete`                                    | `.env.production.local` lacks production Supabase values.                                                                    |
| `No distribution certificate with a private key for team X6TS5L9ZTL` | Import the existing `.p12` from EAS (README → iOS signing). Do not create a new certificate.                                 |
| `No usable App Store profile for <bundle id>`                        | That bundle ID has no App Store profile for the imported certificate. Ask the user before anyone creates one.                |
| `Several distribution identities for team X6TS5L9ZTL`                | Keep only the certificate the profiles use in the login keychain.                                                            |
| fastlane warns that the locale must be UTF-8                         | Harmless (the lane forces UTF-8 for itself and CocoaPods). Add `export LANG=en_US.UTF-8` to the shell profile to silence it. |
| Upload rejected for a duplicate or lower build number                | Another upload raced this one; rerun the lane to pick the next number.                                                       |
| Upload rejected because the version is closed                        | Bump `version` in `app.json`. The fingerprint change triggers a fresh prebuild.                                              |
| Missing watch icon / `CFBundleIconName`                              | `targets/watch/expo-target.config.json` must keep `icon`. Rerun with `clean:true`.                                           |
