#!/usr/bin/env bash
# Read-only preflight for /testflight. Prints statuses only, never secret
# values, and exits 1 when something the iOS release lanes need is missing.
#
#   bash .claude/skills/testflight/preflight.sh            full preflight
#   bash .claude/skills/testflight/preflight.sh --builds   latest TestFlight builds only
set -u

ROOT="$(git rev-parse --show-toplevel)" || exit 1
cd "$ROOT/apps/mobile" || exit 1
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
MODE="${1:-full}"

if [ "$MODE" = "full" ]; then
  fail=0
  echo "Git"
  branch="$(git rev-parse --abbrev-ref HEAD)"
  echo "  ok    branch $branch @ $(git rev-parse --short HEAD)"
  if [ -n "$(git status --porcelain)" ]; then
    echo "  note  uncommitted changes; they go into the build"
  else
    echo "  ok    working tree clean"
  fi
  if git fetch -q origin "$branch" 2>/dev/null; then
    echo "  note  vs origin/$branch: $(git rev-list --count "origin/$branch..HEAD") ahead, $(git rev-list --count "HEAD..origin/$branch") behind"
  fi
  stray="$(git -C "$ROOT" ls-files --others --exclude-standard | grep -i -E '\.(p8|p12|mobileprovision)$|AuthKey_' || true)"
  if [ -n "$stray" ]; then
    echo "  FAIL  key files that git would pick up: $stray"
    fail=1
  else
    echo "  ok    no key files outside the ignore rules"
  fi

  echo "Toolchain"
  xcode="$(xcodebuild -version 2>/dev/null | head -1)"
  if [ -n "$xcode" ]; then echo "  ok    $xcode"; else echo "  FAIL  xcodebuild not found"; fail=1; fi
  if bundle check >/dev/null 2>&1; then echo "  ok    bundle installed"; else echo "  FAIL  run bundle install in apps/mobile"; fail=1; fi
  [ "$fail" -eq 0 ] || { echo "Preflight failed"; exit 1; }
fi

bundle exec ruby - "$MODE" <<'RUBY' 2> >(grep -v -i -E 'warning|deprecat' >&2)
require "dotenv"
require "json"

mode = ARGV[0]
failed = false
ok = ->(message) { puts "  ok    #{message}" }
bad = lambda do |message|
  puts "  FAIL  #{message}"
  failed = true
end
note = ->(message) { puts "  note  #{message}" }

env = File.exist?("fastlane/.env") ? Dotenv.parse("fastlane/.env") : {}
key_id = env["ASC_KEY_ID"].to_s.strip
issuer_id = env["ASC_ISSUER_ID"].to_s.strip
key_path = env["ASC_KEY_PATH"].to_s.strip
key_path = "fastlane/AuthKey_#{key_id}.p8" if key_path.empty?
if mode == "full"
  puts "fastlane/.env"
  bad.("fastlane/.env is missing; copy fastlane/.env.example") if env.empty?
  key_id.empty? ? bad.("ASC_KEY_ID is not set") : ok.("ASC_KEY_ID #{key_id}")
  issuer_id.empty? ? bad.("ASC_ISSUER_ID is not set; the lanes need a team key") : ok.("ASC_ISSUER_ID set")
  if !File.exist?(key_path)
    bad.("App Store Connect key #{key_path} is missing")
  elsif system("git", "check-ignore", "-q", key_path)
    ok.("#{File.basename(key_path)} present and git-ignored")
  else
    bad.("#{key_path} is NOT git-ignored")
  end
  password = env["MATCH_PASSWORD"].to_s
  password.strip.empty? ? bad.("MATCH_PASSWORD is not set") : ok.("MATCH_PASSWORD set (#{password.length} characters)")

  puts "Release JS config (.env, .env.production, .env.local, .env.production.local)"
  files = %w[.env .env.production .env.local .env.production.local].select { |file| File.exist?(file) }
  js = files.empty? ? {} : Dotenv.parse(*files)
  %w[
    EXPO_PUBLIC_SUPABASE_URL EXPO_PUBLIC_SUPABASE_ANON_KEY EXPO_PUBLIC_APP_ENV
    EXPO_PUBLIC_POSTHOG_KEY EXPO_PUBLIC_POSTHOG_HOST
    EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
  ].each { |name| js[name].to_s.strip.empty? ? bad.("#{name} is not set") : ok.("#{name} set") }
  app_env = js["EXPO_PUBLIC_APP_ENV"].to_s
  note.("EXPO_PUBLIC_APP_ENV is '#{app_env}', not 'production'") unless app_env.empty? || app_env == "production"
end

puts "TestFlight"
if key_id.empty? || !File.exist?(key_path)
  bad.("skipped: no App Store Connect key")
else
  begin
    require "spaceship"
    Spaceship::ConnectAPI.token = Spaceship::ConnectAPI::Token.create(
      key_id: key_id, issuer_id: issuer_id.empty? ? nil : issuer_id, filepath: File.expand_path(key_path)
    )
    version = JSON.parse(File.read("app.json")).dig("expo", "version")
    app = Spaceship::ConnectAPI::App.find("com.ogig.sweaty")
    builds = Spaceship::ConnectAPI::Build.all(app_id: app.id, sort: "-uploadedDate", limit: 3, includes: "preReleaseVersion")
    ok.("app.json version #{version}")
    builds.first(3).each do |build|
      ok.("uploaded #{build.app_version} (#{build.version}) #{build.processing_state} at #{build.uploaded_date}")
    end
  rescue StandardError => e
    bad.("App Store Connect lookup failed: #{e.class}: #{e.message.to_s.lines.first.to_s.strip[0, 160]}")
  end
end

puts(failed ? "Preflight failed" : "Preflight passed")
exit(failed ? 1 : 0)
RUBY
