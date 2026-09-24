import Link from "next/link";
import { notFound } from "next/navigation";
import { ExerciseForm } from "@/components/exercise-form";
import { getAdminUser } from "@/lib/supabase/server";

interface EditExercisePageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}

export default async function EditExercisePage({
  params,
  searchParams,
}: EditExercisePageProps) {
  const { id } = await params;
  const { error, saved } = await searchParams;
  const admin = await getAdminUser();
  if (!admin) return null;

  const { data: exercise } = await admin.supabase
    .from("exercises")
    .select(
      "id, name, external_id, primary_muscles, secondary_muscles, equipment, difficulty_level, instructions, image_url, video_url"
    )
    .eq("id", id)
    .single();

  if (!exercise) notFound();

  return (
    <div>
      <Link
        href="/exercises"
        className="text-sm text-text-secondary hover:text-text"
      >
        ← Back to exercises
      </Link>
      <h1 className="mb-6 mt-2 text-xl font-semibold">{exercise.name}</h1>

      {error ? (
        <p className="mb-4 max-w-2xl rounded border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {saved ? (
        <p className="mb-4 max-w-2xl rounded border border-success/40 bg-success/10 p-3 text-sm text-success">
          Saved.
        </p>
      ) : null}

      <ExerciseForm mode="edit" exercise={exercise} />
    </div>
  );
}
