---
name: testflight
description: Use when the user asks to publish, upload, or ship the iOS app to TestFlight / App Store Connect (e.g. "publish the app to the app store so I can test it", "upload a new build to TestFlight"), or to build a signed release IPA. Checks the release setup, then builds locally and uploads with the fastlane `ios beta` lane in the user's terminal.
argument-hint: "[build-only] [clean]"
---

# /testflight

Builds the iOS app locally and uploads it to TestFlight with the fastlane `ios beta` lane. Setup lives in [Releasing with fastlane](../../../apps/mobile/README.md#releasing-with-fastlane), and signing in [iOS signing](../../../apps/mobile/README.md#ios-signing).

Arguments (`$ARGUMENTS`):

- `build-only` builds a signed `apps/mobile/build/ios/Sweaty.ipa` with `ios build` and uploads nothing.
- `clean` forces a fresh `expo prebuild`.

iOS only. Android releases (`npm run release:android`) aren't covered yet.

## Hard rules

- **One shared certificate.** Never create, renew or revoke certificates or profiles:
  - no `fastlane ios certs_create`;
  - no `match` without `readonly`;
  - no fastlane `cert`;
  - no `-allowProvisioningUpdates`;
  - no Xcode automatic signing for Release;
  - never `fastlane match nuke`.

  A signing error is never a reason to make a new certificate. Report it and stop.

- **Secrets stay out of the chat.** Never print, read out or paste the App Store Connect key (`.p8`), `MATCH_PASSWORD`, a `.p12` or `.env` values. The preflight prints only statuses.
- **An upload needs an explicit OK each time.** A TestFlight upload reaches testers, so confirm every run. `build-only` needs no OK.

## 1. Preflight

Run from the repo root:

```bash
bash .claude/skills/testflight/preflight.sh
```

It checks, read-only:

- **git:** branch, commit, uncommitted changes, whether key files are left outside the ignore rules;
- **toolchain:** Xcode and Bundler;
- **`fastlane/.env`:** the App Store Connect key and its git-ignored `.p8`, and `MATCH_PASSWORD`;
- **release JS config:** the `EXPO_PUBLIC_*` values;
- **App Store Connect:** the last three TestFlight uploads.

If it fails, tell the user what's missing and how to fix it; the README setup has the steps. Don't work around it.

Uncommitted changes go into the build. Say so, and ask whether to build anyway.

## 2. Confirm

Show the user and ask for an explicit yes:

- the version (`app.json` → `version`) and the next build number (the latest upload + 1; the lane picks it);
- the branch and commit;
- whether `clean` forces a full prebuild. A changed native fingerprint also triggers one, and it takes several extra minutes.

## 3. Run it in the user's terminal

Run the lane in a new tab of the user's Terminal panel (the `run_in_terminal` tool, with `cwd` set to the repo root), not in Bash:

- the user can watch it, stop it, and answer the macOS dialog that lets `codesign` use the key (**Always Allow**);
- their login shell has their full PATH and Ruby.

| Arguments    | Command                                                                      |
| ------------ | ---------------------------------------------------------------------------- |
| none         | `cd apps/mobile && npm run release:ios`                                      |
| `clean`      | `cd apps/mobile && bundle exec fastlane ios beta clean:true`                 |
| `build-only` | `cd apps/mobile && bundle exec fastlane ios build build_number:<latest + 1>` |

If the terminal tool isn't available, give the user the command and ask them to run it.

The lane:

1. validates the release JS config;
2. installs the shared certificate and App Store profiles from the match repo, read-only;
3. sets the build number;
4. runs `expo prebuild --clean` and `pod install` when the native fingerprint changed;
5. archives and signs `build/ios/Sweaty.ipa`;
6. checks that the watch app and widget are embedded with the same build number;
7. uploads the IPA to TestFlight.

## 4. Wait for the end without polling

fastlane rewrites `apps/mobile/fastlane/report.xml` when a lane ends, whether it succeeds or fails. Start one background watcher right after launching the lane. Use the Monitor tool with a 30-minute timeout, and re-arm it if it expires while the lane is still running:

```bash
f="$(git rev-parse --show-toplevel)/apps/mobile/fastlane/report.xml"; start=$(date +%s); until [ "$(stat -f %m "$f" 2>/dev/null || echo 0)" -gt "$start" ]; do sleep 20; done; sleep 3; if grep -q '<failure' "$f"; then echo "LANE FAILED at $(grep -B2 '<failure' "$f" | grep -o 'name="[^"]*"' | tail -1)"; else echo "LANE FINISHED OK"; fi
```

Then read the tab's last lines with `read_terminal`.

## 5. Report

**On success**, report:

- the build number from `Uploaded build <n> to TestFlight`;
- that Apple processes the build in 5–30 minutes and TestFlight then notifies testers.

To see the build's processing state later, run `bash .claude/skills/testflight/preflight.sh --builds`. A new upload can take a few minutes to show up there.

**On failure**, match the error to the table below, report the cause and the fix, and stop. Don't retry signing steps with other flags.

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
