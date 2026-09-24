import {
  createExercise,
  deleteExercise,
  updateExercise,
} from "@/app/(admin)/exercises/actions";

interface ExerciseFormProps {
  mode: "create" | "edit";
  exercise?: {
    id: string;
    name: string;
    external_id: string | null;
    primary_muscles: string[];
    secondary_muscles: string[] | null;
    equipment: string[];
    difficulty_level: string | null;
    instructions: string | null;
    image_url: string | null;
    video_url: string | null;
  };
}

const inputClass =
  "w-full rounded border border-border bg-bg-elevated px-3 py-2 text-sm outline-none focus:border-primary";

export function ExerciseForm({ mode, exercise }: ExerciseFormProps) {
  const action = mode === "create" ? createExercise : updateExercise;

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-4">
      {exercise ? <input type="hidden" name="id" value={exercise.id} /> : null}

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-text-secondary">Name *</span>
        <input
          name="name"
          required
          defaultValue={exercise?.name}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-text-secondary">External ID</span>
        <input
          name="external_id"
          defaultValue={exercise?.external_id ?? ""}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-text-secondary">
          Primary muscles * (comma separated)
        </span>
        <input
          name="primary_muscles"
          required
          defaultValue={exercise?.primary_muscles.join(", ")}
          placeholder="chest, triceps"
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-text-secondary">
          Secondary muscles (comma separated)
        </span>
        <input
          name="secondary_muscles"
          defaultValue={exercise?.secondary_muscles?.join(", ") ?? ""}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-text-secondary">
          Equipment * (comma separated)
        </span>
        <input
          name="equipment"
          required
          defaultValue={exercise?.equipment.join(", ")}
          placeholder="barbell, bench"
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-text-secondary">Difficulty level</span>
        <select
          name="difficulty_level"
          defaultValue={exercise?.difficulty_level ?? ""}
          className={inputClass}
        >
          <option value="">—</option>
          <option value="beginner">beginner</option>
          <option value="intermediate">intermediate</option>
          <option value="advanced">advanced</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-text-secondary">Instructions</span>
        <textarea
          name="instructions"
          rows={5}
          defaultValue={exercise?.instructions ?? ""}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-text-secondary">Video URL</span>
        <input
          name="video_url"
          defaultValue={exercise?.video_url ?? ""}
          className={inputClass}
        />
      </label>

      <div className="flex flex-col gap-1 text-sm">
        <span className="text-text-secondary">Image</span>
        {exercise?.image_url ? (
          <img
            src={exercise.image_url}
            alt={exercise.name}
            className="mb-2 h-32 w-32 rounded border border-border object-cover"
          />
        ) : null}
        <input
          name="image"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="text-sm text-text-secondary file:mr-3 file:rounded file:border-0 file:bg-bg-elevated file:px-3 file:py-2 file:text-sm file:text-text"
        />
      </div>

      <div className="mt-2 flex items-center gap-3">
        <button
          type="submit"
          className="rounded bg-primary px-4 py-2 text-sm font-medium text-black hover:opacity-90"
        >
          {mode === "create" ? "Create exercise" : "Save changes"}
        </button>
        {mode === "edit" ? (
          <button
            type="submit"
            name="_action"
            value="delete"
            formAction={deleteExercise}
            className="rounded border border-danger/50 px-4 py-2 text-sm text-danger hover:bg-danger/10"
          >
            Delete
          </button>
        ) : null}
      </div>
    </form>
  );
}
