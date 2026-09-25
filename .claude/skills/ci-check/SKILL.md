---
name: ci-check
description: Run the CI "Quality gate" locally the way GitHub Actions sees the repo — format, lint, a CI-like type check without the local expo-env.d.ts and .expo types, and all tests with the known flaky test retried. Use before handing over a PR, or when asked to check CI locally.
argument-hint: "[--no-tests]"
---

# /ci-check

Run from the repo root, with a 10-minute timeout:

```bash
bash .claude/skills/ci-check/ci-check.sh $ARGUMENTS
```

`--no-tests` skips the test step for a quick check.

The script mirrors the "Quality gate" job in `.github/workflows/ci.yml`:

1. `format` — `turbo run format:check`.
2. `lint` — `turbo run lint`. Existing warnings are fine; only errors fail.
3. `types-mobile` — `tsc` for `apps/mobile` with a temporary config that leaves out `.expo/` and `expo-env.d.ts`.
   - Those files are gitignored, so CI doesn't have them.
   - Locally they add Node and route types, which is how a plain `tsc` passed on PR #111 while CI failed.
   - The temporary config is deleted on exit.
4. `types-other` — `turbo run check-types` for every other package.
5. `tests` — `turbo run test`.
   - If the only failure is the known flaky `workout-store` test, the script reruns that file once and counts a pass as green.

It doesn't cover the "Expo sanity" job (`expo config` and `expo export` bundles). Say so when you report.

## Reporting

- Quote each failed step with the relevant log lines. Logs are kept in the temp directory the script prints.
- Fix failures only in files the current change touched. If `format` or `lint` fails in untouched files, report it instead of reformatting them.
- Never report a step as passing when it didn't run.
