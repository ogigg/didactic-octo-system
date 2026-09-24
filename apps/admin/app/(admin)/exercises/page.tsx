import Link from "next/link";
import { getAdminUser } from "@/lib/supabase/server";

const PAGE_SIZE = 25;

interface ExercisesPageProps {
  searchParams: Promise<{ q?: string; page?: string; deleted?: string }>;
}

export default async function ExercisesPage({
  searchParams,
}: ExercisesPageProps) {
  const { q, page, deleted } = await searchParams;
  const admin = await getAdminUser();
  if (!admin) return null;

  const currentPage = Math.max(1, Number(page ?? "1") || 1);
  const query = (q ?? "").trim();

  let supabaseQuery = admin.supabase
    .from("exercises")
    .select(
      "id, name, primary_muscles, equipment, difficulty_level, image_url",
      { count: "exact" }
    )
    .order("name")
    .range((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE - 1);

  if (query) {
    supabaseQuery = supabaseQuery.ilike("name", `%${query}%`);
  }

  const { data: exercises, count } = await supabaseQuery;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          Exercises {count != null ? `(${count})` : null}
        </h1>
        <Link
          href="/exercises/new"
          className="rounded bg-primary px-4 py-2 text-sm font-medium text-black hover:opacity-90"
        >
          New exercise
        </Link>
      </div>

      {deleted ? (
        <p className="mb-4 rounded border border-success/40 bg-success/10 p-3 text-sm text-success">
          Exercise deleted.
        </p>
      ) : null}

      <form className="mb-4 flex gap-2" action="/exercises">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search by name…"
          className="w-72 rounded border border-border bg-bg-elevated px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          type="submit"
          className="rounded border border-border px-4 py-2 text-sm hover:bg-bg-elevated"
        >
          Search
        </button>
      </form>

      <table className="w-full max-w-4xl border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-text-secondary">
            <th className="py-2 pr-4">Image</th>
            <th className="py-2 pr-4">Name</th>
            <th className="py-2 pr-4">Primary muscles</th>
            <th className="py-2 pr-4">Equipment</th>
            <th className="py-2">Difficulty</th>
          </tr>
        </thead>
        <tbody>
          {(exercises ?? []).map((exercise) => (
            <tr key={exercise.id} className="border-b border-border/50">
              <td className="py-2 pr-4">
                {exercise.image_url ? (
                  <img
                    src={exercise.image_url}
                    alt=""
                    className="h-10 w-10 rounded object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 rounded bg-bg-elevated" />
                )}
              </td>
              <td className="py-2 pr-4">
                <Link
                  href={`/exercises/${exercise.id}`}
                  className="text-primary hover:underline"
                >
                  {exercise.name}
                </Link>
              </td>
              <td className="py-2 pr-4 text-text-secondary">
                {exercise.primary_muscles.join(", ")}
              </td>
              <td className="py-2 pr-4 text-text-secondary">
                {exercise.equipment.join(", ")}
              </td>
              <td className="py-2 text-text-secondary">
                {exercise.difficulty_level ?? "—"}
              </td>
            </tr>
          ))}
          {!exercises?.length ? (
            <tr>
              <td colSpan={5} className="py-8 text-center text-text-secondary">
                No exercises found.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {totalPages > 1 ? (
        <div className="mt-4 flex items-center gap-3 text-sm text-text-secondary">
          {currentPage > 1 ? (
            <Link
              href={`/exercises?q=${encodeURIComponent(query)}&page=${currentPage - 1}`}
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
              href={`/exercises?q=${encodeURIComponent(query)}&page=${currentPage + 1}`}
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
