---
name: publish-to-testflight
description: Use when the user asks to publish, upload, or ship the iOS app to TestFlight / App Store Connect (e.g. "publish the app to the app store so I can test it", "upload a new build to TestFlight"). Builds the iOS app locally and uploads it with the fastlane `ios beta` lane.
---

# Publish iOS App to TestFlight

Run the fastlane `ios beta` lane from `apps/mobile`. It builds locally and uploads to TestFlight. Setup details live in [Releasing with fastlane](../../apps/mobile/README.md#releasing-with-fastlane).

## Prerequisites (verify before starting)

- macOS with Xcode, and `bundle install` already run in `apps/mobile`.
- `apps/mobile/fastlane/.env` sets `ASC_KEY_ID`, plus `ASC_ISSUER_ID` for a team key. The matching `.p8` is at `apps/mobile/fastlane/AuthKey_<ASC_KEY_ID>.p8` or at `ASC_KEY_PATH`. Both files are git-ignored. If they are missing, ask the user to create them. Never commit, print, or paste key contents.
- `apps/mobile/.env.production.local` holds the production `EXPO_PUBLIC_*` values. The lane refuses to build without a hosted HTTPS Supabase URL and anon key.
- `apps/mobile/fastlane/.env` sets `MATCH_PASSWORD`, and the user can read the private `ogigg/sweaty-signing` repo. That repo holds the team's one shared distribution certificate and the App Store profiles for `com.ogig.sweaty`, `com.ogig.sweaty.SweatyWidget` and `com.ogig.sweaty.SweatyWatch`; see [iOS signing](../../apps/mobile/README.md#ios-signing). The lane installs them itself, read-only.
- Never create, regenerate or revoke certificates or profiles without the user's explicit consent. That includes running anything with `-allowProvisioningUpdates`, fastlane `cert`, `match` without `readonly`, or `fastlane ios certs_create`. Never run `fastlane match nuke`. The release lanes only read them.
- The app record `com.ogig.sweaty` exists in App Store Connect, and the version in `app.json` is still open for new builds.

## Steps

1. From `apps/mobile`, run:

   ```bash
   npm run release:ios
   ```

   The lane:
   - validates the config;
   - installs the shared certificate and App Store profiles from the match repo (read-only) and checks the certificate's private key in the keychain;
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

| Error                                                        | Cause / fix                                                                                                                                            |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Set ASC_KEY_ID ...` / `App Store Connect API key not found` | `fastlane/.env` or the `.p8` is missing. See `fastlane/.env.example`.                                                                                  |
| `Release JS config is incomplete`                            | `.env.production.local` lacks production Supabase values.                                                                                              |
| `cannot create a new one because you enabled readonly`       | The match repo is empty, or its certificate or profiles expired. Creating or renewing them (`fastlane ios certs_create`) needs the user's explicit OK. |
| `Invalid password passed via 'MATCH_PASSWORD'`               | `MATCH_PASSWORD` in `fastlane/.env` doesn't match the repo. Copy it from the team password manager. Never create a new certificate for this.           |
| `... has no private key in the keychain`                     | Run `bundle exec fastlane ios certs`. Do not create a new certificate.                                                                                 |
| `Other valid identities share the name ...`                  | Delete the listed SHA-1s in Keychain Access → My Certificates, keep the match certificate's SHA-1, then run `ios certs` again.                         |
| `The shared signing assets expire on ...`                    | Renewal is due. Tell the user; renewing (`fastlane ios certs_create`) needs their explicit OK.                                                         |
| fastlane warns that the locale must be UTF-8                 | Harmless (the lane forces UTF-8 for itself and CocoaPods). Add `export LANG=en_US.UTF-8` to the shell profile to silence it.                           |
| Upload rejected for a duplicate or lower build number        | Another upload raced this one; rerun the lane to pick the next number.                                                                                 |
| Upload rejected because the version is closed                | Bump `version` in `app.json`. The fingerprint change triggers a fresh prebuild.                                                                        |
| Missing watch icon / `CFBundleIconName`                      | `targets/watch/expo-target.config.json` must keep `icon`. Rerun with `clean:true`.                                                                     |
