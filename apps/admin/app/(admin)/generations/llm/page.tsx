import Link from "next/link";
import { getAdminUser } from "@/lib/supabase/server";

const PAGE_SIZE = 25;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const WINDOWS = {
  "24h": { label: "Last 24 hours", ms: 24 * 60 * 60 * 1000 },
  "7d": { label: "Last 7 days", ms: 7 * 24 * 60 * 60 * 1000 },
  "30d": { label: "Last 30 days", ms: 30 * 24 * 60 * 60 * 1000 },
} as const;
const STATUSES = ["success", "parse_error", "api_error", "timeout"] as const;

interface SearchParams {
  window?: string;
  status?: string;
  provider?: string;
  function?: string;
  request?: string;
  failure?: string;
  page?: string;
}

interface ModelLog {
  id: string;
  created_at: string;
  function_name: string;
  model: string;
  status: string;
  duration_ms: number | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  reasoning_tokens: number | null;
  cost_usd: number | null;
  provider: string | null;
  finish_reason: string | null;
  failure_code: string | null;
  user_id: string | null;
  pending_workout_id: string | null;
  attempt_id: string | null;
  request_id: string | null;
}

interface ProviderMetric {
  provider: string;
  calls: number;
  valid_success: number;
  valid_success_rate: number | null;
  failures: number;
  avg_duration_ms: number | null;
  p50_duration_ms: number | null;
  p95_duration_ms: number | null;
  reasoning_tokens: number | null;
  completion_tokens: number | null;
  cost_usd: number | null;
}

interface ModelMetrics {
  calls: number;
  valid_success: number;
  valid_success_rate: number | null;
  failures: number;
  avg_duration_ms: number | null;
  p50_duration_ms: number | null;
  p95_duration_ms: number | null;
  reasoning_tokens: number | null;
  completion_tokens: number | null;
  cost_usd: number | null;
  linked_attempts: number;
  fallback_attempts: number;
  fallback_rate: number | null;
  providers: ProviderMetric[];
}

function safeWindow(value?: string) {
  return value && Object.hasOwn(WINDOWS, value)
    ? (value as keyof typeof WINDOWS)
    : "24h";
}

function safeStatus(value?: string) {
  return value && STATUSES.includes(value as (typeof STATUSES)[number])
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

function percentage(value: number | null) {
  return value == null ? "—" : `${(value * 100).toFixed(1)}%`;
}

function cost(value: number | string | null) {
  if (value == null) return "—";
  const amount = Number(value);
  return Number.isFinite(amount) ? `$${amount.toFixed(4)}` : "—";
}

function statusClass(status: string) {
  if (status === "success") return "badge badge-success";
  if (status === "parse_error") return "badge badge-warning";
  return "badge badge-danger";
}

function queryString(
  params: SearchParams,
  overrides: Partial<SearchParams> = {}
) {
  const next = { ...params, ...overrides };
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(next)) {
    if (value && !(key === "page" && value === "1")) query.set(key, value);
  }
  return query.toString();
}

function Metric({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string | number;
  note: string;
  tone?: "warning" | "danger" | "running";
}) {
  return (
    <div className={`metric-card${tone ? ` ${tone}` : ""}`}>
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
      <span className="metric-note">{note}</span>
    </div>
  );
}

export default async function RawGenerationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const admin = await getAdminUser();
  if (!admin) return null;

  const windowKey = safeWindow(params.window);
  const status = safeStatus(params.status);
  const provider = (params.provider ?? "").trim().slice(0, 120);
  const functionName = (params.function ?? "").trim().slice(0, 120);
  const failureCode = (params.failure ?? "").trim().slice(0, 120);
  const requestId = safeUuid(params.request);
  const page = Math.min(
    1000,
    Math.max(1, Math.floor(Number(params.page ?? "1")) || 1)
  );
  const requestLookup = Boolean(requestId);
  const from = requestLookup
    ? new Date(0).toISOString()
    : new Date(Date.now() - WINDOWS[windowKey].ms).toISOString();
  const scopeLabel = requestLookup
    ? "Request lookup • all dates"
    : WINDOWS[windowKey].label;

  let listQuery = admin.supabase
    .from("llm_generation_logs")
    .select(
      "id, created_at, function_name, model, status, duration_ms, prompt_tokens, completion_tokens, reasoning_tokens, cost_usd, provider, finish_reason, failure_code, user_id, pending_workout_id, attempt_id, request_id",
      { count: "exact" }
    )
    .gte("created_at", from)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status !== "all") listQuery = listQuery.eq("status", status);
  if (provider) listQuery = listQuery.eq("provider", provider);
  if (functionName) listQuery = listQuery.eq("function_name", functionName);
  if (failureCode) listQuery = listQuery.eq("failure_code", failureCode);
  if (requestId) listQuery = listQuery.eq("request_id", requestId);

  const [listResult, metricsResult] = await Promise.all([
    listQuery,
    admin.supabase.rpc("llm_generation_metrics", {
      p_since: from,
      p_status: status === "all" ? null : status,
      p_provider: provider || null,
      p_function_name: functionName || null,
      p_failure_code: failureCode || null,
      p_request_id: requestId || null,
    }),
  ]);
  const logs = (listResult.data ?? []) as ModelLog[];
  const metrics = (metricsResult.data ?? null) as ModelMetrics | null;
  const count = listResult.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const invalidRequest = Boolean(params.request && !requestId);

  return (
    <div className="dashboard-shell">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Generation pipeline / raw traces</p>
          <h1>LLM model logs</h1>
          <p className="lede">
            Provider decisions, token budgets, finish reasons, and raw model
            output for every call.
          </p>
        </div>
        <Link href="/generations" className="button button-quiet">
          ← Attempts dashboard
        </Link>
      </div>

      <form className="filter-panel" action="/generations/llm" method="get">
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
          Model outcome
          <select name="status" defaultValue={status}>
            <option value="all">All calls</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label>
          Provider
          <input
            name="provider"
            defaultValue={provider}
            placeholder="Optional"
          />
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
          Failure code
          <input
            name="failure"
            defaultValue={failureCode}
            placeholder="e.g. token_limit"
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

      {invalidRequest ? (
        <div className="callout callout-warning">
          Request filter must be a valid UUID. The invalid value was ignored.
        </div>
      ) : null}
      {requestLookup ? (
        <div className="callout">
          Request lookup includes all dates so historical attempts remain
          traceable.
        </div>
      ) : null}
      {listResult.error || metricsResult.error ? (
        <div className="callout callout-danger">
          Could not load model diagnostics. Check the database migration and
          refresh the page.
        </div>
      ) : null}

      <div className="metric-grid">
        <Metric
          label="Model calls"
          value={metrics?.calls ?? "—"}
          note={`${scopeLabel} • selected filters`}
        />
        <Metric
          label="Valid responses"
          value={percentage(metrics?.valid_success_rate ?? null)}
          note={`${metrics?.valid_success ?? "—"} schema-valid calls`}
        />
        <Metric
          label="Fallback rate"
          value={percentage(metrics?.fallback_rate ?? null)}
          note={`${metrics?.fallback_attempts ?? "—"} of ${metrics?.linked_attempts ?? "—"} linked attempts`}
          tone={metrics?.fallback_attempts ? "warning" : undefined}
        />
        <Metric
          label="Model latency"
          value={duration(metrics?.avg_duration_ms ?? null)}
          note={
            metrics?.p50_duration_ms != null || metrics?.p95_duration_ms != null
              ? `p50 ${duration(metrics.p50_duration_ms)} · p95 ${duration(metrics.p95_duration_ms)}`
              : "average completed calls"
          }
        />
        <Metric
          label="Tracked cost"
          value={cost(metrics?.cost_usd ?? null)}
          note={`${metrics?.reasoning_tokens ?? "—"} reasoning tokens`}
        />
      </div>

      <section className="panel panel-table">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Provider comparison</p>
            <h2>Latency and valid output by route</h2>
          </div>
          <span className="panel-note">Aggregated in Supabase</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Calls</th>
                <th>Valid</th>
                <th>Failures</th>
                <th>Avg / p50 / p95 model time</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              {(metrics?.providers ?? []).map((item) => (
                <tr key={item.provider}>
                  <td className="strong-cell">{item.provider}</td>
                  <td>{item.calls}</td>
                  <td>
                    {percentage(item.valid_success_rate)}
                    <span className="subline">{item.valid_success} valid</span>
                  </td>
                  <td className={item.failures ? "text-danger" : "muted-cell"}>
                    {item.failures}
                  </td>
                  <td className="muted-cell">
                    {duration(item.avg_duration_ms)} /{" "}
                    {duration(item.p50_duration_ms)} /{" "}
                    {duration(item.p95_duration_ms)}
                  </td>
                  <td className="muted-cell">{cost(item.cost_usd)}</td>
                </tr>
              ))}
              {!metrics?.providers?.length ? (
                <tr>
                  <td colSpan={6} className="empty-state">
                    No provider metrics are available for this window.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel panel-table" style={{ marginTop: "1rem" }}>
        <div className="panel-header">
          <div>
            <p className="eyebrow">Request archive</p>
            <h2>{count} model calls in view</h2>
          </div>
          <span className="panel-note">
            Model time is measured around the provider request.
          </span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Created</th>
                <th>Provider / model</th>
                <th>Outcome</th>
                <th>Model time</th>
                <th>Tokens</th>
                <th>Diagnostics</th>
                <th>Attempt</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>
                    <Link
                      href={`/generations/llm/${log.id}`}
                      className="table-link"
                    >
                      {new Date(log.created_at).toLocaleString()}
                    </Link>
                    <span className="subline">
                      {log.request_id
                        ? `request ${log.request_id.slice(0, 8)}…`
                        : "legacy trace"}
                    </span>
                  </td>
                  <td>
                    <span className="strong-cell">
                      {log.provider ?? "legacy / unknown"}
                    </span>
                    <span className="subline">{log.model}</span>
                  </td>
                  <td>
                    <span className={statusClass(log.status)}>
                      {log.status.replaceAll("_", " ")}
                    </span>
                    {log.failure_code ? (
                      <span className="subline">{log.failure_code}</span>
                    ) : null}
                  </td>
                  <td className="muted-cell">{duration(log.duration_ms)}</td>
                  <td className="muted-cell">
                    {log.prompt_tokens ?? "—"} / {log.completion_tokens ?? "—"}
                    <span className="subline">
                      reasoning {log.reasoning_tokens ?? "—"}
                    </span>
                  </td>
                  <td>
                    <span className="muted-cell">
                      {log.finish_reason ?? "—"}
                    </span>
                    <span className="subline">{cost(log.cost_usd)}</span>
                  </td>
                  <td>
                    {log.attempt_id ? (
                      <Link
                        href={`/generations/attempts/${log.attempt_id}`}
                        className="trace-link"
                      >
                        View attempt →
                      </Link>
                    ) : (
                      <span className="muted-cell">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {!logs.length ? (
                <tr>
                  <td colSpan={7} className="empty-state">
                    No generation logs found for this window.
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
                  href={`/generations/llm?${queryString(params, { page: String(page - 1) })}`}
                >
                  ← Previous
                </Link>
              ) : null}
              {page < totalPages ? (
                <Link
                  href={`/generations/llm?${queryString(params, { page: String(page + 1) })}`}
                >
                  Next →
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
