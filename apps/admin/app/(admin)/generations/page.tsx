import Link from "next/link";
import { getAdminUser } from "@/lib/supabase/server";

const PAGE_SIZE = 25;

const STATUS_STYLES: Record<string, string> = {
  success: "text-success",
  parse_error: "text-warning",
  api_error: "text-danger",
  timeout: "text-danger",
};

interface GenerationsPageProps {
  searchParams: Promise<{ status?: string; page?: string }>;
}

export default async function GenerationsPage({
  searchParams,
}: GenerationsPageProps) {
  const { status, page } = await searchParams;
  const admin = await getAdminUser();
  if (!admin) return null;

  const currentPage = Math.max(1, Number(page ?? "1") || 1);

  let query = admin.supabase
    .from("llm_generation_logs")
    .select(
      "id, created_at, function_name, model, status, duration_ms, prompt_tokens, completion_tokens, user_id, pending_workout_id",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE - 1);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data: logs, count } = await query;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const statuses = ["all", "success", "parse_error", "api_error", "timeout"];

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">
        LLM generation logs {count != null ? `(${count})` : null}
      </h1>

      <div className="mb-4 flex gap-2 text-sm">
        {statuses.map((s) => (
          <Link
            key={s}
            href={`/generations?status=${s}`}
            className={`rounded border px-3 py-1 ${
              (status ?? "all") === s
                ? "border-primary text-primary"
                : "border-border text-text-secondary hover:text-text"
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-text-secondary">
            <th className="py-2 pr-4">Created</th>
            <th className="py-2 pr-4">Function</th>
            <th className="py-2 pr-4">Model</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Duration</th>
            <th className="py-2 pr-4">Tokens (p/c)</th>
            <th className="py-2">User</th>
          </tr>
        </thead>
        <tbody>
          {(logs ?? []).map((log) => (
            <tr key={log.id} className="border-b border-border/50">
              <td className="py-2 pr-4">
                <Link
                  href={`/generations/${log.id}`}
                  className="text-primary hover:underline"
                >
                  {new Date(log.created_at).toLocaleString()}
                </Link>
              </td>
              <td className="py-2 pr-4">{log.function_name}</td>
              <td className="py-2 pr-4 text-text-secondary">{log.model}</td>
              <td className={`py-2 pr-4 ${STATUS_STYLES[log.status] ?? ""}`}>
                {log.status}
              </td>
              <td className="py-2 pr-4 text-text-secondary">
                {log.duration_ms != null ? `${log.duration_ms} ms` : "—"}
              </td>
              <td className="py-2 pr-4 text-text-secondary">
                {log.prompt_tokens ?? "—"} / {log.completion_tokens ?? "—"}
              </td>
              <td className="py-2 font-mono text-xs text-text-secondary">
                {log.user_id?.slice(0, 8) ?? "—"}
              </td>
            </tr>
          ))}
          {!logs?.length ? (
            <tr>
              <td colSpan={7} className="py-8 text-center text-text-secondary">
                No generation logs found.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {totalPages > 1 ? (
        <div className="mt-4 flex items-center gap-3 text-sm text-text-secondary">
          {currentPage > 1 ? (
            <Link
              href={`/generations?status=${status ?? "all"}&page=${currentPage - 1}`}
              className="hover:text-text"
            >
              ← Previous
            </Link>
          ) : null}
          <span>
            Page {currentPage} of {totalPages}
          </span>
          {currentPage < totalPages ? (
            <Link
              href={`/generations?status=${status ?? "all"}&page=${currentPage + 1}`}
              className="hover:text-text"
            >
              Next →
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
