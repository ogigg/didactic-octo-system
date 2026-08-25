---
name: publish-to-testflight
description: Use when the user asks to publish, upload, or ship the iOS app to TestFlight / App Store Connect (e.g. "publish the app to the app store so I can test it", "upload a new build to TestFlight"). Builds the iOS archive locally via xcodebuild and uploads it with fastlane pilot.
---

# Publish iOS App to TestFlight

Build the iOS app locally with `xcodebuild`, then upload the `.ipa` to TestFlight via fastlane. All commands run from `apps/mobile`.

## Prerequisites (verify before starting)

- macOS with Xcode installed; signing team is set in the Xcode project (`DEVELOPMENT_TEAM = X6TS5L9ZTL`, bundle ID `com.ogig.sweaty`).
- `fastlane` installed (`brew install fastlane`).
- Valid credentials at `apps/mobile/fastlane/api-key.json`. This file is **gitignored** — if missing, ask the user to recreate it. Its `key` field must contain the **full contents** of the `.p8` App Store Connect API key (including the `-----BEGIN PRIVATE KEY-----` lines), NOT a file path. This fastlane version passes `key` directly to `OpenSSL::PKey::EC.new()`; a path string causes "invalid curve name". Required JSON shape:

```json
{
  "key_id": "<KEY_ID>",
  "issuer_id": "<ISSUER_ID>",
  "key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----",
  "in_house": false
}
```

- The app record for bundle ID `com.ogig.sweaty` must exist in App Store Connect.
- Bump the marketing/build version first if needed (build number must be higher than any previously uploaded build).

## Steps

Run from `apps/mobile/` unless noted.

### 1. Install pods (skip if `ios/Pods` is up to date)

```bash
pod install --project-directory=ios
```

(or from the repo root: `npx pod-install`.)

### 2. Archive

```bash
xcodebuild -workspace ios/Sweaty.xcworkspace -scheme Sweaty \
  -configuration Release -archivePath build/App.xcarchive archive
```

This takes several minutes. If it fails on code signing, verify certificates/profiles exist (`security find-identity -v -p codesigning`).

### 3. Export .ipa

An `ExportOptions.plist` already exists at `ios/ExportOptions.plist` (method `app-store-connect`, automatic signing, team `X6TS5L9ZTL`). Recreate it if missing:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>method</key>
	<string>app-store-connect</string>
	<key>teamID</key>
	<string>X6TS5L9ZTL</string>
	<key>signingStyle</key>
	<string>automatic</string>
	<key>uploadSymbols</key>
	<true/>
</dict>
</plist>
```

Export:

```bash
xcodebuild -exportArchive \
  -archivePath build/App.xcarchive \
  -exportOptionsPlist ios/ExportOptions.plist \
  -exportPath build/ipa \
  -allowProvisioningUpdates
```

### 4. Upload to TestFlight

```bash
fastlane pilot upload --ipa build/ipa/*.ipa --api_key_path fastlane/api-key.json
```

### 5. Verify & report

- Upload success means the build is processing on Apple's side; TestFlight availability can lag 5–30+ minutes.
- Check processing status: `fastlane pilot builds` (or App Store Connect → TestFlight).
- Report to the user: build number uploaded, expected wait time, and that testers get notified automatically once processed.

## Troubleshooting

| Error                                                   | Cause / fix                                                                                            |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `invalid curve name (OpenSSL::PKey::PKeyError)`         | `api-key.json`'s `key` field contains a path instead of key contents. Inline the `.p8` file contents.  |
| `missing field(s): key`                                 | JSON uses `filepath` instead of `key`; this fastlane version requires inline contents under `key`.     |
| `Please sign in with an app-specific password`          | No valid API key JSON; create one per Prerequisites (API key preferred over app-specific passwords).   |
| `Could not determine provider public id from Bundle ID` | App record doesn't exist yet in App Store Connect, or bad credentials.                                 |
| Signing/export failures                                 | Run with `-allowProvisioningUpdates`; check the Apple ID account in Xcode has the team's certificates. |

## Notes

- Never commit `fastlane/api-key.json` or any `.p8` file (both are gitignored).
- For fully remote builds without local Xcode, `eas build` + `eas submit` is an alternative — but this repo's documented flow is local xcodebuild + fastlane.
