#!/usr/bin/env bash
# Runs the CI "Quality gate" job (.github/workflows/ci.yml) locally, the way CI
# sees the repo. The "Expo sanity" job (expo export) isn't covered.
#
# Usage: bash .claude/skills/ci-check/ci-check.sh [--no-tests]
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel)" || exit 1
cd "$ROOT" || exit 1

# Fails now and then in full parallel runs and passes on rerun.
KNOWN_FLAKY_TEST="keeps a failed watch Health export retryable after summary dismissal"
KNOWN_FLAKY_FILE="stores/__tests__/workout-store.test.ts"

MOBILE_CI_TSCONFIG="apps/mobile/tsconfig.ci-check.json"
LOG_DIR="$(mktemp -d "${TMPDIR:-/tmp}/ci-check.XXXXXX")"
RUN_TESTS=1
[ "${1:-}" = "--no-tests" ] && RUN_TESTS=0

cleanup() {
  rm -f "$ROOT/$MOBILE_CI_TSCONFIG"
}
trap cleanup EXIT INT TERM

FAILED=""

step() {
  local name="$1"
  shift
  printf '▶ %-14s ' "$name"
  if "$@" >"$LOG_DIR/$name.log" 2>&1; then
    echo "ok"
    return 0
  fi
  echo "FAILED (log: $LOG_DIR/$name.log)"
  tail -n 30 "$LOG_DIR/$name.log" | sed 's/^/    /'
  FAILED="$FAILED $name"
  return 1
}

step format npx turbo run format:check --ui=stream
step lint npx turbo run lint --ui=stream

# CI has no generated apps/mobile/expo-env.d.ts or .expo/types. Locally they
# pull in Node and route types, so a plain `tsc` can pass while CI fails.
cat >"$MOBILE_CI_TSCONFIG" <<'JSON'
{
  "extends": "./tsconfig.json",
  "include": ["**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules", ".expo", "expo-env.d.ts"]
}
JSON
step types-mobile npx tsc -p "$MOBILE_CI_TSCONFIG" --noEmit
step types-other npx turbo run check-types --filter='!mobile' --ui=stream

if [ "$RUN_TESTS" -eq 1 ]; then
  if ! step tests npx turbo run test --ui=stream; then
    failing="$(grep -oE '● .+ › .+' "$LOG_DIR/tests.log" | sort -u)"
    if [ -n "$failing" ] && ! printf '%s\n' "$failing" | grep -vqF "$KNOWN_FLAKY_TEST"; then
      printf '  Only the known flaky test failed; rerunning %s…\n' "$KNOWN_FLAKY_FILE"
      if (cd apps/mobile && npx jest "$KNOWN_FLAKY_FILE") >"$LOG_DIR/flaky-rerun.log" 2>&1; then
        echo "  Passed on rerun, so the tests count as green."
        FAILED="${FAILED/ tests/}"
      else
        echo "  Still failing on rerun (log: $LOG_DIR/flaky-rerun.log)."
      fi
    fi
  fi
else
  echo "▶ tests          skipped (--no-tests)"
fi

echo
if [ -z "$FAILED" ]; then
  echo "Quality gate: all checks passed. Logs: $LOG_DIR"
  exit 0
fi
echo "Quality gate: failed:$FAILED. Logs: $LOG_DIR"
exit 1
