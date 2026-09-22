import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminUser } from "@/lib/supabase/server";

interface StageTrace {
  stage?: string;
  started_at?: string;
  duration_ms?: number;
  details?: unknown;
}
interface Attempt {
  id: string;
  request_id: string | null;
  user_id: string | null;
  pending_workout_id: string | null;
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
  final_output: unknown | null;
}
interface ModelLog {
  id: string;
  created_at: string;
  function_name: string;
  model: string;
  status: string;
  duration_ms: number | null;
  provider: string | null;
  finish_reason: string | null;
  reasoning_tokens: number | null;
  cost_usd: number | null;
  failure_code: string | null;
  error_message: string | null;
  request_id: string | null;
  raw_response: unknown | null;
  parsed_content: unknown | null;
}

function humanStatus(status: string) {
  return status.replaceAll("_", " ");
}
function statusClass(status: string) {
  if (status === "succeeded") return "badge badge-success";
  if (status === "succeeded_with_fallback") return "badge badge-warning";
  if (status === "running") return "badge badge-running";
  return "badge badge-danger";
}
function pretty(value: unknown) {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}
function duration(value: number | null) {
  if (value == null) return "—";
  return value < 1000 ? `${value} ms` : `${(value / 1000).toFixed(1)} s`;
}
function stageState(
  stage: StageTrace,
  index: number,
  stages: StageTrace[],
  attempt: Attempt
) {
  if (
    ["failed", "timed_out", "rejected"].includes(attempt.status) &&
    index === stages.length - 1
  )
    return "failed";
  if (attempt.status === "running" && index === stages.length - 1)
    return "running";
  return "complete";
}

export default async function GenerationAttemptDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const filters = await searchParams;
  const admin = await getAdminUser();
  if (!admin) return null;
  const [
    { data: attemptData, error: attemptError },
    { data: logs, error: logsError },
  ] = await Promise.all([
    admin.supabase
      .from("generation_attempts")
      .select("*")
      .eq("id", id)
      .single(),
    admin.supabase
      .from("llm_generation_logs")
      .select(
        "id, created_at, function_name, model, status, duration_ms, provider, finish_reason, reasoning_tokens, cost_usd, failure_code, error_message, request_id, raw_response, parsed_content"
      )
      .eq("attempt_id", id)
      .order("created_at", { ascending: true }),
  ]);
  if (!attemptData && !attemptError) notFound();
  if (!attemptData)
    return (
      <div className="callout callout-danger">
        Could not load this generation attempt.
      </div>
    );
  const attempt = attemptData as Attempt;
  const stages = Array.isArray(attempt.stages) ? attempt.stages : [];
  const modelLogs = (logs ?? []) as ModelLog[];
  const measuredModelLogs = modelLogs.filter((log) => log.duration_ms != null);
  const modelDurationMs = measuredModelLogs.reduce(
    (total, log) => total + (log.duration_ms ?? 0),
    0
  );
  const awaitingPersistenceMs = stages
    .filter((stage) => stage.stage === "awaiting_persistence")
    .reduce((total, stage) => total + (stage.duration_ms ?? 0), 0);
  const persistenceMs = stages
    .filter((stage) => stage.stage === "persistence")
    .reduce((total, stage) => total + (stage.duration_ms ?? 0), 0);
  const readyStage = stages.find(
    (stage) =>
      ["awaiting_persistence", "persistence"].includes(stage.stage ?? "") &&
      stage.started_at
  );
  const preparationMs = readyStage?.started_at
    ? Math.max(
        0,
        new Date(readyStage.started_at).getTime() -
          new Date(attempt.started_at).getTime()
      )
    : null;
  const backQuery = new URLSearchParams();
  for (const key of [
    "window",
    "outcome",
    "function",
    "user",
    "request",
    "page",
  ])
    if (filters[key]) backQuery.set(key, filters[key]!);
  const backHref = backQuery.toString()
    ? `/generations?${backQuery}`
    : "/generations";
  return (
    <div className="dashboard-shell">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Generation attempt / trace</p>
          <h1>{attempt.function_name}</h1>
          <p className="lede">
            {new Date(attempt.started_at).toLocaleString()} ·{" "}
            {attempt.trigger ?? "unknown trigger"}
          </p>
        </div>
        <Link href={backHref} className="button button-quiet">
          ← Back to attempts
        </Link>
      </div>
      {attemptError || logsError ? (
        <div className="callout callout-danger">
          Some trace data could not be loaded. Refresh after checking the
          database.
        </div>
      ) : null}
      <section className="attempt-hero">
        <div>
          <span className={statusClass(attempt.status)}>
            {humanStatus(attempt.status)}
          </span>
          <h2>
            {attempt.generation_source === "llm"
              ? "LLM generated workout"
              : attempt.generation_source
                ? `Fallback: ${attempt.generation_source}`
                : "Generation outcome"}
          </h2>
          <p>
            {attempt.fallback_reason ??
              attempt.error_message ??
              "Trace completed without an operator note."}
          </p>
        </div>
        <div className="hero-stats">
          <span>
            <small>End-to-end</small>
            <strong>{duration(attempt.duration_ms)}</strong>
          </span>
          <span>
            <small>
              Model time ({measuredModelLogs.length}/{modelLogs.length})
            </small>
            <strong>
              {measuredModelLogs.length ? duration(modelDurationMs) : "—"}
            </strong>
          </span>
          <span>
            <small>Queue wait</small>
            <strong>
              {awaitingPersistenceMs ? duration(awaitingPersistenceMs) : "—"}
            </strong>
          </span>
          <span>
            <small>Database persistence</small>
            <strong>{persistenceMs ? duration(persistenceMs) : "—"}</strong>
          </span>
          <span>
            <small>Workout prepared in</small>
            <strong>
              {preparationMs != null ? duration(preparationMs) : "—"}
            </strong>
          </span>
          <span>
            <small>Trace ID</small>
            <code>{attempt.id}</code>
          </span>
          <span>
            <small>Request ID</small>
            {attempt.request_id ? (
              <Link
                href={`/generations?window=30d&request=${attempt.request_id}`}
                className="trace-link"
              >
                {attempt.request_id}
              </Link>
            ) : (
              <code>—</code>
            )}
          </span>
        </div>
      </section>
      <div className="detail-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Execution path</p>
              <h2>Stage timeline</h2>
            </div>
            <span className="stage-chip">{attempt.stage ?? "complete"}</span>
          </div>
          {stages.length ? (
            <div className="timeline">
              {stages.map((stage, index) => {
                const state = stageState(stage, index, stages, attempt);
                return (
                  <div
                    className={`timeline-item ${state}`}
                    key={`${stage.stage}-${stage.started_at}-${index}`}
                  >
                    <span className="timeline-marker">
                      {state === "complete"
                        ? "✓"
                        : state === "failed"
                          ? "!"
                          : "·"}
                    </span>
                    <div>
                      <div className="timeline-title">
                        <strong>
                          {stage.stage
                            ? humanStatus(stage.stage)
                            : "Unnamed stage"}
                        </strong>
                        <span>
                          {stage.duration_ms != null
                            ? `${stage.duration_ms} ms`
                            : state === "running"
                              ? "in progress"
                              : "—"}
                        </span>
                      </div>
                      {stage.started_at ? (
                        <time>
                          {new Date(stage.started_at).toLocaleString()}
                        </time>
                      ) : null}
                      {stage.details != null ? (
                        <details>
                          <summary>Stage details</summary>
                          <pre>{pretty(stage.details)}</pre>
                        </details>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-mini">
              No stage checkpoints were recorded for this attempt.
            </div>
          )}
        </section>
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Context</p>
              <h2>Trace metadata</h2>
            </div>
          </div>
          <dl className="metadata-list">
            <div>
              <dt>User</dt>
              <dd>
                <code>{attempt.user_id ?? "—"}</code>
              </dd>
            </div>
            <div>
              <dt>Pending workout</dt>
              <dd>
                <code>{attempt.pending_workout_id ?? "—"}</code>
              </dd>
            </div>
            <div>
              <dt>Started</dt>
              <dd>{new Date(attempt.started_at).toLocaleString()}</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{new Date(attempt.updated_at).toLocaleString()}</dd>
            </div>
            <div>
              <dt>Finished</dt>
              <dd>
                {attempt.finished_at
                  ? new Date(attempt.finished_at).toLocaleString()
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>Error</dt>
              <dd className="text-danger">
                {attempt.error_code ? `${attempt.error_code}: ` : ""}
                {attempt.error_message ?? "—"}
              </dd>
            </div>
          </dl>
        </section>
      </div>
      <section className="panel output-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Result inspection</p>
            <h2>Final output</h2>
          </div>
        </div>
        {attempt.final_output != null ? (
          <details className="json-disclosure" open>
            <summary>
              Workout payload<span>⌄</span>
            </summary>
            <pre>{pretty(attempt.final_output)}</pre>
          </details>
        ) : (
          <div className="empty-mini">No final output was stored.</div>
        )}
      </section>
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Model calls</p>
            <h2>Linked raw logs</h2>
          </div>
          <Link
            href={`/generations/llm?request=${attempt.request_id ?? ""}`}
            className="trace-link"
          >
            Open archive →
          </Link>
        </div>
        {logs?.length ? (
          <div className="linked-logs">
            {modelLogs.map((log) => (
              <div className="linked-log" key={log.id}>
                <div>
                  <Link
                    href={`/generations/llm/${log.id}`}
                    className="table-link"
                  >
                    {log.function_name}
                  </Link>
                  <span className="subline">
                    {log.provider ?? "legacy / unknown"} · {log.model} ·{" "}
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>
                <span
                  className={
                    log.status === "success"
                      ? "badge badge-success"
                      : "badge badge-danger"
                  }
                >
                  {log.status}
                </span>
                <span className="muted-cell">
                  {duration(log.duration_ms)}
                  <span className="subline">
                    {log.failure_code ?? log.finish_reason ?? ""}
                  </span>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-mini">
            No raw model logs are linked to this attempt.
          </div>
        )}
      </section>
      {logs?.length ? (
        <section className="panel output-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Raw vs final</p>
              <h2>Raw model output</h2>
            </div>
          </div>
          {modelLogs.map((log) => (
            <details className="json-disclosure" key={`raw-${log.id}`}>
              <summary>
                {log.function_name} · {log.model}
                <span>⌄</span>
              </summary>
              <pre>{pretty(log.raw_response ?? log.parsed_content)}</pre>
            </details>
          ))}
        </section>
      ) : null}
    </div>
  );
}
