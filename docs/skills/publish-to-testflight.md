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
- Signing needs the Admin role: either a team key with Admin access, or an Admin Apple ID signed in to Xcode → Settings → Accounts for team `X6TS5L9ZTL`. An App Manager or individual key can upload but cannot create distribution certificates or profiles.
- The app record `com.ogig.sweaty` exists in App Store Connect, and the version in `app.json` is still open for new builds.

## Steps

1. From `apps/mobile`, run:

   ```bash
   npm run release:ios
   ```

   The lane:
   - validates the config;
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

| Error                                                                    | Cause / fix                                                                                                                    |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `Set ASC_KEY_ID ...` / `App Store Connect API key not found`             | `fastlane/.env` or the `.p8` is missing. See `fastlane/.env.example`.                                                          |
| `Release JS config is incomplete`                                        | `.env.production.local` lacks production Supabase values.                                                                      |
| `No Accounts` / `No profiles for 'com.ogig.sweaty' were found`           | Signing has no Admin credentials. Use a team key with Admin access, or sign in to Xcode with an Admin Apple ID.                |
| fastlane warns that the locale must be UTF-8                             | Harmless (the lane forces UTF-8 for itself and CocoaPods). Add `export LANG=en_US.UTF-8` to the shell profile to silence it.   |
| `Your team has no devices from which to generate a provisioning profile` | Automatic signing archives with development profiles first. Register an iPhone (and paired Apple Watch) for team `X6TS5L9ZTL`. |
| Upload rejected for a duplicate or lower build number                    | Another upload raced this one; rerun the lane to pick the next number.                                                         |
| Upload rejected because the version is closed                            | Bump `version` in `app.json`. The fingerprint change triggers a fresh prebuild.                                                |
| Missing watch icon / `CFBundleIconName`                                  | `targets/watch/expo-target.config.json` must keep `icon`. Rerun with `clean:true`.                                             |
