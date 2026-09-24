import Link from "next/link";
import { getAdminUser } from "@/lib/supabase/server";
import { recoverStaleAttempts } from "./actions";

const PAGE_SIZE = 20;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WINDOWS = {
  "1h": { label: "Last hour", ms: 60 * 60 * 1000 },
  "24h": { label: "Last 24 hours", ms: 24 * 60 * 60 * 1000 },
  "7d": { label: "Last 7 days", ms: 7 * 24 * 60 * 60 * 1000 },
  "30d": { label: "Last 30 days", ms: 30 * 24 * 60 * 60 * 1000 },
} as const;
const OUTCOMES = [
  "succeeded",
  "succeeded_with_fallback",
  "running",
  "rejected",
  "failed",
  "timed_out",
] as const;

interface StageTrace {
  stage?: string;
  started_at?: string;
  duration_ms?: number;
  details?: unknown;
}
interface GenerationAttempt {
  id: string;
  request_id: string | null;
  user_id: string | null;
  function_name: string;
  trigger: string | null;
  status: string;
  stage: string | null;
  stages: StageTrace[] | null;
  started_at: string;
  updated_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  generation_source: string | null;
  fallback_reason: string | null;
  error_code: string | null;
  error_message: string | null;
}
interface AttemptMetrics {
  total: number;
  fallbacks: number;
  failures: number;
  rejected: number;
  running: number;
  stale: number;
  avg_duration_ms: number | null;
  p95_duration_ms: number | null;
  stage_failures: Record<string, number>;
}
interface SearchParams {
  window?: string;
  outcome?: string;
  function?: string;
  user?: string;
  request?: string;
  page?: string;
  recovered?: string;
  recovery_error?: string;
}

function safeWindow(value?: string) {
  return value && Object.hasOwn(WINDOWS, value)
    ? (value as keyof typeof WINDOWS)
    : "24h";
}
function safeOutcome(value?: string) {
  return value && OUTCOMES.includes(value as (typeof OUTCOMES)[number])
    ? value
    : "all";
}
function safeUuid(value?: string) {
  return value && UUID_RE.test(value) ? value : "";
}
function duration(value: number | null) {
  if (value == null) return "—";
  return value < 1000 ? `${value} ms` : `${(value / 1000).toFixed(1)} s`;
}
function shortId(value: string | null) {
  return value ? `${value.slice(0, 8)}…${value.slice(-4)}` : "—";
}
function outcomeLabel(value: string) {
  return value.replaceAll("_", " ");
}
function outcomeClass(value: string) {
  if (value === "succeeded") return "badge badge-success";
  if (value === "succeeded_with_fallback") return "badge badge-warning";
  if (value === "running") return "badge badge-running";
  return "badge badge-danger";
}
function queryString(
  params: SearchParams,
  overrides: Partial<SearchParams> = {}
) {
  const next = { ...params, ...overrides };
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(next))
    if (value && !(key === "page" && value === "1")) query.set(key, value);
  return query.toString();
}

export default async function GenerationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const admin = await getAdminUser();
  if (!admin) return null;
  const windowKey = safeWindow(params.window);
  const outcome = safeOutcome(params.outcome);
  const functionName = (params.function ?? "").trim().slice(0, 120);
  const userId = safeUuid(params.user);
  const requestId = safeUuid(params.request);
  const invalidUser = Boolean(params.user && !userId);
  const invalidRequest = Boolean(params.request && !requestId);
  const page = Math.min(
    1000,
    Math.max(1, Math.floor(Number(params.page ?? "1")) || 1)
  );
  const from = requestId
    ? new Date(0).toISOString()
    : new Date(Date.now() - WINDOWS[windowKey].ms).toISOString();
  let listQuery = admin.supabase
    .from("generation_attempts")
    .select(
      "id, request_id, user_id, function_name, trigger, status, stage, stages, started_at, updated_at, finished_at, duration_ms, generation_source, fallback_reason, error_code, error_message",
      { count: "exact" }
    )
    .gte("started_at", from)
    .order("started_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (outcome !== "all") listQuery = listQuery.eq("status", outcome);
  if (functionName) listQuery = listQuery.eq("function_name", functionName);
  if (userId) listQuery = listQuery.eq("user_id", userId);
  if (requestId) listQuery = listQuery.eq("request_id", requestId);
  const [listResult, metricsResult] = await Promise.all([
    listQuery,
    admin.supabase.rpc("generation_attempt_metrics", {
      p_since: from,
      p_status: outcome === "all" ? null : outcome,
      p_function_name: functionName || null,
      p_user_id: userId || null,
      p_request_id: requestId || null,
    }),
  ]);
  const { data, count, error } = listResult;
  const attempts = (data ?? []) as GenerationAttempt[];
  const metrics = (metricsResult.data ?? null) as AttemptMetrics | null;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const stageFailures = Object.entries(metrics?.stage_failures ?? {});
  const baseParams = {
    window: windowKey,
    outcome,
    function: functionName,
    user: userId,
    request: requestId,
  };
  return (
    <div className="dashboard-shell">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Operations / generation pipeline</p>
          <h1>Generation control room</h1>
          <p className="lede">
            Trace every workout request from intake to a usable plan.
          </p>
        </div>
        <Link href="/generations/llm" className="button button-quiet">
          Raw model logs ↗
        </Link>
      </div>
      {requestId ? (
        <p className="muted-cell">Request lookup includes all dates.</p>
      ) : null}
      <form className="filter-panel" action="/generations" method="get">
        <label>
          Window
          <select name="window" defaultValue={windowKey}>
            {Object.entries(WINDOWS).map(([key, value]) => (
              <option key={key} value={key}>
                {value.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Outcome
          <select name="outcome" defaultValue={outcome}>
            <option value="all">All outcomes</option>
            {OUTCOMES.map((value) => (
              <option key={value} value={value}>
                {outcomeLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Function
          <input
            name="function"
            defaultValue={functionName}
            placeholder="e.g. generate-workout"
          />
        </label>
        <label>
          User UUID
          <input
            name="user"
            defaultValue={params.user ?? ""}
            placeholder="Optional UUID"
          />
        </label>
        <label>
          Request UUID
          <input
            name="request"
            defaultValue={params.request ?? ""}
            placeholder="Optional UUID"
          />
        </label>
        <button className="button button-primary" type="submit">
          Apply filters
        </button>
      </form>
      {invalidUser || invalidRequest ? (
        <div className="callout callout-warning">
          User and request filters must be valid UUIDs. Invalid values were
          ignored.
        </div>
      ) : null}
      {error || metricsResult.error ? (
        <div className="callout callout-danger">
          The generation attempt query failed. Check the database migration and
          try again.
        </div>
      ) : null}
      {params.recovery_error ? (
        <div role="alert" className="callout callout-danger">
          Recovery failed. Check Supabase function/database logs and retry.
        </div>
      ) : null}
      {params.recovered != null ? (
        <div role="status" className="callout">
          Recovered {Math.max(0, Number(params.recovered) || 0)} stale attempts
          or pending rows.
        </div>
      ) : null}
      <p className="panel-note">
        Counts include queue requests and their individual workout attempts.
        Expected rejections: {metrics?.rejected ?? "—"}.
      </p>
      <div className="metric-grid">
        <Metric
          label="Attempts"
          value={metrics?.total ?? count ?? "—"}
          note={`${WINDOWS[windowKey].label} • attempt rows`}
        />
        <Metric
          label="Fallbacks"
          value={metrics?.fallbacks ?? "—"}
          note="model fallback or repaired IDs"
          tone="warning"
        />
        <Metric
          label="Failures"
          value={metrics?.failures ?? "—"}
          note="failed or timed out"
          tone="danger"
        />
        <Metric
          label="Running"
          value={metrics?.running ?? "—"}
          note={
            metrics?.stale ? `${metrics.stale} stale > 5 min` : "none stale"
          }
          tone={metrics?.stale ? "danger" : "running"}
        />
        <Metric
          label="Average latency"
          value={duration(metrics?.avg_duration_ms ?? null)}
          note={
            metrics?.p95_duration_ms != null
              ? `p95 ${duration(metrics.p95_duration_ms)}`
              : "completed attempts"
          }
        />
      </div>
      <div className="content-grid">
        <section className="panel panel-table">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Recent traces</p>
              <h2>{count ?? 0} attempts in view</h2>
            </div>
            <div className="panel-actions">
              <a
                href={`/generations?${queryString(baseParams)}`}
                className="live-dot"
              >
                Refresh
              </a>
              <form action={recoverStaleAttempts}>
                <input
                  type="hidden"
                  name="return_to"
                  value={`/generations?${queryString(baseParams)}`}
                />
                <button className="text-button" type="submit">
                  Recover all stale
                </button>
              </form>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Started</th>
                  <th>Outcome</th>
                  <th>Function / trigger</th>
                  <th>Current stage</th>
                  <th>Source</th>
                  <th>Latency</th>
                  <th>Trace</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((attempt) => (
                  <tr key={attempt.id}>
                    <td>
                      <Link
                        href={`/generations/attempts/${attempt.id}?${queryString(baseParams, { page: String(page) })}`}
                        className="table-link"
                      >
                        {new Date(attempt.started_at).toLocaleString()}
                      </Link>
                      <span className="subline">
                        {shortId(attempt.request_id)}
                      </span>
                    </td>
                    <td>
                      <span className={outcomeClass(attempt.status)}>
                        {outcomeLabel(attempt.status)}
                      </span>
                      {attempt.error_code ? (
                        <span className="subline text-danger">
                          {attempt.error_code}
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <span className="strong-cell">
                        {attempt.function_name}
                      </span>
                      <span className="subline">{attempt.trigger ?? "—"}</span>
                    </td>
                    <td>
                      <span className="stage-chip">
                        {attempt.stage ?? "complete"}
                      </span>
                      {attempt.error_message ? (
                        <span className="subline text-danger">
                          {attempt.error_message.slice(0, 64)}
                        </span>
                      ) : null}
                    </td>
                    <td className="muted-cell">
                      {attempt.generation_source ?? "—"}
                    </td>
                    <td className="muted-cell">
                      {duration(attempt.duration_ms)}
                    </td>
                    <td>
                      <Link
                        href={`/generations/attempts/${attempt.id}?${queryString(baseParams, { page: String(page) })}`}
                        className="trace-link"
                      >
                        View trace →
                      </Link>
                    </td>
                  </tr>
                ))}
                {!attempts.length ? (
                  <tr>
                    <td colSpan={7} className="empty-state">
                      No generation attempts match this window and filter set.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {totalPages > 1 ? (
            <div className="pagination">
              <span>
                Page {page} of {totalPages}
              </span>
              <div>
                {page > 1 ? (
                  <Link
                    href={`/generations?${queryString(baseParams, { page: String(page - 1) })}`}
                  >
                    ← Previous
                  </Link>
                ) : null}
                {page < totalPages ? (
                  <Link
                    href={`/generations?${queryString(baseParams, { page: String(page + 1) })}`}
                  >
                    Next →
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>
        <section className="panel stage-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Where requests fail</p>
              <h2>Stage failure counts</h2>
            </div>
          </div>
          <p className="panel-note">
            Exact across the selected window and filters.
          </p>
          {stageFailures.length ? (
            <div className="failure-list">
              {stageFailures
                .sort((a, b) => b[1] - a[1])
                .map(([stage, failures]) => (
                  <div className="failure-row" key={stage}>
                    <span>{stage}</span>
                    <strong>{failures}</strong>
                  </div>
                ))}
            </div>
          ) : (
            <div className="empty-mini">No failed stages in this view.</div>
          )}
        </section>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  note,
  tone = "",
}: {
  label: string;
  value: string | number;
  note: string;
  tone?: string;
}) {
  return (
    <div className={`metric-card ${tone}`}>
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
      <span className="metric-note">{note}</span>
    </div>
  );
}
