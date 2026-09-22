import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminUser } from "@/lib/supabase/server";

interface SetShape {
  set_type?: string;
  target_load_kg?: number;
  target_reps?: number;
  target_duration_seconds?: number;
}
interface ParsedExercise {
  exercise_id?: string;
  load_kg?: number | null;
  sets?: SetShape[];
}
interface ParsedContent {
  workout_name?: string;
  exercises?: ParsedExercise[];
}

function JsonSection({
  title,
  value,
}: {
  title: string;
  value: unknown | null;
}) {
  if (value == null) return null;
  return (
    <details className="json-disclosure" open={title === "Parsed content"}>
      <summary>
        {title}
        <span>⌄</span>
      </summary>
      <pre>
        {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

function ZeroLoadWarnings({ parsed }: { parsed: ParsedContent | null }) {
  const zeroLoad =
    parsed?.exercises?.filter(
      (ex) =>
        ex.load_kg === 0 ||
        ex.sets?.some(
          (set) => set.set_type === "working" && (set.target_load_kg ?? 0) === 0
        )
    ) ?? [];
  if (!zeroLoad.length) return null;
  return (
    <div className="callout callout-warning">
      <strong>
        {zeroLoad.length} exercise(s) with working sets at 0 kg load
      </strong>
      <ul>
        {zeroLoad.map((exercise) => (
          <li key={exercise.exercise_id}>{exercise.exercise_id}</li>
        ))}
      </ul>
    </div>
  );
}

export default async function RawGenerationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = await getAdminUser();
  if (!admin) return null;
  const { data: log } = await admin.supabase
    .from("llm_generation_logs")
    .select("*")
    .eq("id", id)
    .single();
  if (!log) notFound();
  const parsed = log.parsed_content as ParsedContent | null;
  const message = log.raw_response as {
    choices?: { message?: { content?: string } }[];
  } | null;
  const rawContent = message?.choices?.[0]?.message?.content;
  return (
    <div className="dashboard-shell">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Raw model trace</p>
          <h1>{log.function_name}</h1>
          <p className="lede">
            {new Date(log.created_at).toLocaleString()} · {log.model} ·{" "}
            {log.status}
            {log.duration_ms != null ? ` · ${log.duration_ms} ms` : ""}
          </p>
        </div>
        <div className="heading-actions">
          <Link href="/generations/llm" className="button button-quiet">
            ← Raw logs
          </Link>
          {log.attempt_id ? (
            <Link
              href={`/generations/attempts/${log.attempt_id}`}
              className="button button-primary"
            >
              Open attempt ↗
            </Link>
          ) : null}
        </div>
      </div>
      <div className="trace-meta">
        <div>
          <span>User</span>
          <code>{log.user_id ?? "—"}</code>
        </div>
        <div>
          <span>Pending workout</span>
          <code>{log.pending_workout_id ?? "—"}</code>
        </div>
        <div>
          <span>Request</span>
          {log.request_id ? (
            <Link
              href={`/generations/llm?request=${log.request_id}`}
              className="trace-link"
            >
              {log.request_id}
            </Link>
          ) : (
            <code>—</code>
          )}
        </div>
        <div>
          <span>Provider</span>
          <strong>{log.provider ?? "legacy / unknown"}</strong>
        </div>
        <div>
          <span>Finish reason</span>
          <strong>{log.finish_reason ?? "—"}</strong>
        </div>
        <div>
          <span>Model time</span>
          <strong>
            {log.duration_ms != null ? `${log.duration_ms} ms` : "—"}
          </strong>
        </div>
        <div>
          <span>Reasoning tokens</span>
          <strong>{log.reasoning_tokens ?? "—"}</strong>
        </div>
        <div>
          <span>Cost</span>
          <strong>
            {log.cost_usd == null ? "—" : `$${Number(log.cost_usd).toFixed(4)}`}
          </strong>
        </div>
        <div>
          <span>Failure code</span>
          <strong>{log.failure_code ?? "—"}</strong>
        </div>
        <div>
          <span>Tokens (prompt / completion)</span>
          <strong>
            {log.prompt_tokens ?? "—"} / {log.completion_tokens ?? "—"}
          </strong>
        </div>
      </div>
      <ZeroLoadWarnings parsed={parsed} />
      <JsonSection title="Parsed content" value={parsed} />
      <JsonSection title="Request settings" value={log.request_settings} />
      <JsonSection title="Reasoning content" value={log.reasoning_content} />
      <JsonSection title="Model response (content)" value={rawContent} />
      <JsonSection title="Raw response" value={log.raw_response} />
      <JsonSection title="Request messages" value={log.request_messages} />
      <JsonSection title="Provider error" value={log.error_message} />
    </div>
  );
}
