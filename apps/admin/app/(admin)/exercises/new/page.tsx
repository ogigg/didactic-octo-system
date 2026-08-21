import Link from "next/link";
import { ExerciseForm } from "@/components/exercise-form";

interface NewExercisePageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function NewExercisePage({
  searchParams,
}: NewExercisePageProps) {
  const { error } = await searchParams;

  return (
    <div>
      <Link
        href="/exercises"
        className="text-sm text-text-secondary hover:text-text"
      >
        ← Back to exercises
      </Link>
      <h1 className="mb-6 mt-2 text-xl font-semibold">New exercise</h1>

      {error ? (
        <p className="mb-4 max-w-2xl rounded border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <ExerciseForm mode="create" />
    </div>
  );
}
