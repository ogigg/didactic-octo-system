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
  sets?: SetShape[];
}

interface ParsedContent {
  workout_name?: string;
  exercises?: ParsedExercise[];
}

function ZeroLoadWarnings({ parsed }: { parsed: ParsedContent | null }) {
  if (!parsed?.exercises) return null;

  const zeroLoad = parsed.exercises.filter((ex) =>
    ex.sets?.some(
      (set) => set.set_type === "working" && (set.target_load_kg ?? 0) === 0
    )
  );

  if (!zeroLoad.length) return null;

  return (
    <div className="mb-6 rounded border border-warning/40 bg-warning/10 p-4 text-sm">
      <div className="font-medium text-warning">
        {zeroLoad.length} exercise(s) with working sets at 0 kg load
      </div>
      <ul className="mt-2 list-inside list-disc font-mono text-xs text-text-secondary">
        {zeroLoad.map((ex) => (
          <li key={ex.exercise_id}>{ex.exercise_id}</li>
        ))}
      </ul>
    </div>
  );
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
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-semibold text-text-secondary">
        {title}
      </h2>
      <pre className="max-h-[32rem] overflow-auto rounded border border-border bg-bg-elevated p-4 text-xs leading-relaxed">
        {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
      </pre>
    </section>
  );
}

export default async function GenerationDetailPage({
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
    choices?: { message?: { content?: string; reasoning?: string } }[];
  } | null;
  const rawContent = message?.choices?.[0]?.message?.content;

  return (
    <div>
      <Link
        href="/generations"
        className="text-sm text-text-secondary hover:text-text"
      >
        ← Back to generations
      </Link>

      <div className="mb-6 mt-2 flex flex-wrap items-baseline gap-4">
        <h1 className="text-xl font-semibold">Generation trace</h1>
        <span className="text-sm text-text-secondary">
          {new Date(log.created_at).toLocaleString()} · {log.function_name} ·{" "}
          {log.model} · {log.status}
          {log.duration_ms != null ? ` · ${log.duration_ms} ms` : ""}
        </span>
      </div>

      <dl className="mb-6 grid max-w-3xl grid-cols-2 gap-x-8 gap-y-2 text-sm md:grid-cols-4">
        <div>
          <dt className="text-text-secondary">User</dt>
          <dd className="font-mono text-xs break-all">{log.user_id ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-text-secondary">Pending workout</dt>
          <dd className="font-mono text-xs break-all">
            {log.pending_workout_id ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-text-secondary">Tokens (prompt / completion)</dt>
          <dd>
            {log.prompt_tokens ?? "—"} / {log.completion_tokens ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-text-secondary">Error</dt>
          <dd className="break-all">{log.error_message ?? "—"}</dd>
        </div>
      </dl>

      {parsed ? <ZeroLoadWarnings parsed={parsed} /> : null}

      <JsonSection title="Parsed content" value={parsed} />
      <JsonSection title="Reasoning content" value={log.reasoning_content} />
      <JsonSection title="Model response (content)" value={rawContent} />
      <JsonSection title="Raw response" value={log.raw_response} />
      <JsonSection title="Request messages" value={log.request_messages} />
    </div>
  );
}
