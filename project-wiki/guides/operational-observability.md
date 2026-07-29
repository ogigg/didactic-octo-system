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

No workout names, exercise notes, custom prompts, feedback text, email
addresses, raw request bodies, or raw backend error messages are sent.
Authenticated backend user IDs are SHA-256 hashed with
`OBSERVABILITY_HASH_SALT`; PostHog person profiles are disabled for backend
events. Mobile exception messages are redacted before sending, while exception
types and stack frames remain available for grouping.

PostHog exception autocapture covers JavaScript exceptions, unhandled promise
rejections, and native iOS/Android crashes. Source maps and native debug symbols
are uploaded by release builds.

## Required configuration

Set these Supabase Edge Function secrets in every monitored environment:

```text
POSTHOG_PROJECT_KEY=<PostHog project token>
POSTHOG_HOST=https://us.i.posthog.com
OBSERVABILITY_HASH_SALT=<environment-specific random secret>
APP_VERSION=<deployed backend release/version>
```

Set these secrets in the EAS production and preview build environments:

```text
EXPO_PUBLIC_POSTHOG_KEY=<PostHog project token>
EXPO_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
POSTHOG_CLI_PERSONAL_API_KEY=<source-map upload key>
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

| Tile                    | Filter and aggregation                                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Crash-free sessions     | `$exception` divided by application sessions; break down by `app_version`, `platform`, and `journey_stage`             |
| Generation latency      | `area = generation`, p50/p95 of `duration_ms`, unique affected users                                                   |
| Generation failures     | `area = generation AND outcome = failure`, rate and unique affected users; break down by `failure_code`                |
| Validation failures     | `failure_code IN (response_validation_failed, output_validation_failed)`                                               |
| Fallback rate           | `area = generation AND outcome = fallback` divided by all completed generation events; break down by `fallback_reason` |
| Stale queue recovery    | `operation = stale_queue_recovery`; break down by `outcome`, with p50/p95 `queue_age_ms`                               |
| Sync latency            | `area = sync AND outcome IN (success, recovered)`, p50/p95 of `latency_ms`, unique affected users                      |
| Sync dead letters       | `failure_code = sync_dead_letter`, count and unique affected users                                                     |
| Feedback delivery       | `operation = feedback_delivery`; success/failure rate, p50/p95 `duration_ms`, unique affected users                    |
| Test incident lifecycle | `operation = controlled_failure_test`; break down by `test_incident_id` and `outcome`                                  |

Use HogQL `quantile(0.5)` and `quantile(0.95)` for percentile tiles and
`uniqExact(distinct_id)` for affected-user counts. Keep the dashboard default at
24 hours and add saved 7-day and 30-day views for release comparisons.

## Alerts

Use insight alerts with repeated notifications suppressed while the same alert
remains firing. Put this URL and the owner in every alert description:

`https://github.com/ogigg/didactic-octo-system/blob/main/project-wiki/guides/operational-observability.md`

| Alert                  | Threshold                                                     | Evaluation |
| ---------------------- | ------------------------------------------------------------- | ---------- |
| Production crash spike | 3 or more `$exception` events from 2 or more users            | 5 minutes  |
| Generation failures    | failure rate above 5%, with at least 10 generation events     | 15 minutes |
| Generation p95         | p95 `duration_ms` above 15 seconds, with at least 10 events   | 15 minutes |
| Generation fallback    | fallback rate above 25%, with at least 10 events              | 15 minutes |
| Generation validation  | 3 or more validation failures                                 | 15 minutes |
| Stale queue recovery   | any `stale_queue_recovery` failure                            | 15 minutes |
| Sync dead letters      | any `sync_dead_letter`                                        | 15 minutes |
| Sync failure rate      | failure rate above 5%, with at least 20 sync attempts         | 15 minutes |
| Sync p95               | p95 `latency_ms` above 30 seconds, with at least 20 successes | 15 minutes |
| Feedback delivery      | 3 or more failures                                            | 15 minutes |
| Controlled test        | any `controlled_failure_test` with `outcome = triggered`      | 5 minutes  |

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

Deploy `observability-test` to a non-production Supabase project, then call it
with the service-role bearer token:

```bash
curl -X POST "$SUPABASE_URL/functions/v1/observability-test" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"state":"triggered","test_incident_id":"swe-101-preview"}'
```

Confirm the event appears in **Sweaty — Operational Health**, the controlled
test alert fires once, the notification contains the owner and this runbook,
and no request body or identity is visible.

Then emit the resolution marker:

```bash
curl -X POST "$SUPABASE_URL/functions/v1/observability-test" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"state":"resolved","test_incident_id":"swe-101-preview"}'
```

Confirm the lifecycle tile shows both states and the alert resolves after its
evaluation window. Record trigger time, notification time, resolution time,
environment, and tester in the release checklist.
