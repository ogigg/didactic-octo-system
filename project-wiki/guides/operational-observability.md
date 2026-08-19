# Operational Observability

## Purpose

PostHog is the single operational view for mobile crashes, handled critical
errors, workout generation, sync delivery, and feedback delivery. This guide is
the owner and runbook target for every alert created from those signals.

**Primary owner:** Oskar Gierszewski
**Backup owner:** the engineer currently responsible for the mobile/backend
release

## Signals

All custom signals use the `operational_event` event and this privacy-safe
allowlist:

- `area`, `operation`, `outcome`, `severity`
- `journey_stage`, `app_version`, `platform`
- `duration_ms`, `latency_ms`, `queue_age_ms`, `retry_count`
- `failure_code`, `fallback_reason`, `generation_source`
- `count`, `fallback_count`, `test_incident_id`
- `authoritative_source`, `correlation_id`

No workout names, exercise notes, custom prompts, feedback text, email
addresses, raw request bodies, or raw backend error messages are sent.
An authenticated Edge Function derives an opaque HMAC identity from the
Supabase user ID. Mobile identifies PostHog with that value after sign-in,
resets it on sign-out or account switch, and sends it as
`x-observability-id`; authenticated Edge Functions validate any supplied claim
and independently derive the same identity. Supabase UUIDs never leave the
backend. PostHog person profiles are disabled for backend events.

Every delivery signal has one authoritative source. Generation and feedback
delivery are Edge-authoritative; sync is mobile-authoritative. Stable
server-private keys are HMAC-derived into `correlation_id`/`$insert_id`, so
retries deduplicate without exposing database IDs. Mobile handled errors emit
only `operational_event`, never `$exception`, so they cannot inflate crash
alerts.

PostHog exception autocapture covers uncaught JavaScript exceptions and
unhandled promise rejections. `before_send` redacts exception reasons and adds
`crash_classification = fatal_or_unhandled`; stack frames and exception types
remain available for grouping. Native crash autocapture is intentionally
disabled because native exception reasons bypass this enforceable redaction
hook. Do not enable native capture or native symbol upload until a built-app
privacy test proves native reasons are redacted before upload. JavaScript source
maps may still be uploaded by release builds.

## Required configuration

Set these Supabase Edge Function secrets in every monitored environment:

```text
POSTHOG_PROJECT_KEY=<PostHog project token>
POSTHOG_HOST=https://us.i.posthog.com
OBSERVABILITY_IDENTITY_SECRET=<environment-specific random HMAC secret>
APP_ENVIRONMENT=<development|preview|staging|production>
APP_VERSION=<deployed backend release/version>
```

Set `ENABLE_OBSERVABILITY_TEST_INCIDENTS=true` only in the non-production
environment used for the controlled alert exercise. Leave it unset or `false`
everywhere else.

Set these secrets in the EAS production and preview build environments:

```text
EXPO_PUBLIC_POSTHOG_KEY=<PostHog project token>
EXPO_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
POSTHOG_CLI_PERSONAL_API_KEY=<JavaScript source-map upload key>
POSTHOG_CLI_PROJECT_ID=<numeric PostHog project id>
POSTHOG_CLI_HOST=https://us.posthog.com
```

Enable exception autocapture in the PostHog project error-tracking settings.
Preview builds must use a non-production PostHog project or include an
environment property configured in PostHog so test incidents cannot page the
production owner.

## Dashboard contract

Create one PostHog dashboard named **Sweaty — Operational Health**. Every tile
uses `operational_event` unless explicitly noted and shows both the total and
unique `distinct_id` count for affected users.

| Tile                    | Filter and aggregation                                                                                                                                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Crash-free sessions     | `1 - uniqExact($session_id where $exception AND crash_classification = fatal_or_unhandled) / uniqExact($session_id on application session events)`; break down by `app_version`, `platform`, and `journey_stage` |
| Generation latency      | `area = generation AND outcome IN (success, fallback)`, p50/p95 of `duration_ms`, unique affected users                                                                                                          |
| Generation failures     | `area = generation AND outcome = failure AND authoritative_source = edge`, rate and unique affected users; break down by `failure_code`                                                                          |
| Validation failures     | `failure_code IN (response_validation_failed, output_validation_failed)`                                                                                                                                         |
| Fallback rate           | `area = generation AND outcome = fallback` divided by all completed generation events; break down by `fallback_reason`                                                                                           |
| Stale queue recovery    | `operation = stale_queue_recovery`; break down by `outcome`, with p50/p95 `queue_age_ms`                                                                                                                         |
| Sync latency            | `area = sync AND outcome IN (success, recovered)`, p50/p95 of `latency_ms`, unique affected users                                                                                                                |
| Sync dead letters       | `failure_code = sync_dead_letter`, count and unique affected users                                                                                                                                               |
| Feedback delivery       | `operation = feedback_delivery AND authoritative_source = edge`; success/failure rate, p50/p95 `duration_ms`, unique affected users                                                                              |
| Test incident lifecycle | `operation = controlled_failure_test`; break down by `test_incident_id` and `outcome`                                                                                                                            |

Use HogQL `quantile(0.5)` and `quantile(0.95)` for percentile tiles and
`uniqExact(distinct_id)` for affected-user counts. Keep the dashboard default at
24 hours and add saved 7-day and 30-day views for release comparisons.

## Alerts

Use insight alerts with repeated notifications suppressed while the same alert
remains firing. Put this URL and the owner in every alert description:

`https://github.com/ogigg/didactic-octo-system/blob/main/project-wiki/guides/operational-observability.md`

| Alert                  | Threshold                                                                                           | Evaluation |
| ---------------------- | --------------------------------------------------------------------------------------------------- | ---------- |
| Production crash spike | 3 or more `$exception` events with `crash_classification = fatal_or_unhandled` from 2 or more users | 5 minutes  |
| Generation failures    | failure rate above 5%, with at least 10 generation events                                           | 15 minutes |
| Generation p95         | p95 `duration_ms` above 15 seconds, with at least 10 events                                         | 15 minutes |
| Generation fallback    | fallback rate above 25%, with at least 10 events                                                    | 15 minutes |
| Generation validation  | 3 or more validation failures                                                                       | 15 minutes |
| Stale queue recovery   | any `stale_queue_recovery` failure                                                                  | 15 minutes |
| Sync dead letters      | any `sync_dead_letter`                                                                              | 15 minutes |
| Sync failure rate      | failure rate above 5%, with at least 20 sync attempts                                               | 15 minutes |
| Sync p95               | p95 `latency_ms` above 30 seconds, with at least 20 successes                                       | 15 minutes |
| Feedback delivery      | 3 or more failures                                                                                  | 15 minutes |
| Controlled test        | latest state per `test_incident_id` is `triggered`                                                  | 5 minutes  |

Route production alerts to the operational notification channel and the primary
owner. Preview alerts go only to the test channel.

## Incident response

1. Acknowledge the alert and open the linked dashboard filtered to the alert
   window.
2. Confirm `app_version`, `platform`, `journey_stage`, affected-user count, and
   whether one fingerprint or failure code dominates.
3. For generation, compare p95, fallback reason, validation failures, and stale
   recovery. Check OpenRouter and Supabase status before changing thresholds.
4. For sync, inspect the operation name, queue age, retry count, and dead-letter
   volume. Do not inspect or export queued payloads.
5. For feedback delivery, check Supabase and Resend health and configuration.
6. Mitigate through rollback, provider recovery, or retry/recovery tooling.
7. Confirm the event rate returns below threshold, resolve the incident, and
   record affected-user recovery.

Do not lower a noisy threshold during an active incident. First group by
fingerprint/failure code, fix duplicate reporting, or add a minimum-volume
guard.

## Controlled verification

`observability-test` fails closed unless `APP_ENVIRONMENT` is `development`,
`preview`, or `staging`, `ENABLE_OBSERVABILITY_TEST_INCIDENTS=true`, all
PostHog/identity secrets are present, and the service-role bearer token matches.
It always returns 404 in production even if accidentally enabled. The endpoint
awaits PostHog capture and returns an error unless ingestion acknowledges it.

Deploy it only to a non-production Supabase project, then call it with the
service-role bearer token:

```bash
curl -X POST "$SUPABASE_URL/functions/v1/observability-test" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"state":"triggered","test_incident_id":"swe-101-preview"}'
```

Confirm the event appears in **Sweaty — Operational Health**, the controlled
test alert fires once, the notification contains the owner and this runbook,
and no request body or identity is visible.

Configure the controlled alert with a state-aware query that groups by
`test_incident_id` and evaluates only the row whose state has the greatest event
timestamp (for example, `argMax(outcome, timestamp) = 'triggered'`). Then emit
the resolution state:

```bash
curl -X POST "$SUPABASE_URL/functions/v1/observability-test" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"state":"resolved","test_incident_id":"swe-101-preview"}'
```

Confirm the lifecycle tile shows both states and the state-aware alert clears
after its next evaluation. If the PostHog plan cannot alert on a state-aware
query, use a triggered-only rolling-window alert and document that it resolves
only when the five-minute window expires; never claim the `resolved` event
itself clears that alert. Record trigger time, notification time, resolution
time, environment, and tester in the release checklist.

## External verification blockers

Creating the real PostHog dashboard/alerts and routing notifications requires
project credentials. JavaScript source-map uploads, any future privacy-safe
native symbol path, production configuration, and the non-production
trigger/resolve exercise require EAS, PostHog, and Supabase deployment access.
These are release verification tasks and are not proven by repository tests.
