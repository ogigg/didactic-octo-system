"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/supabase/server";

type AdminContext = NonNullable<Awaited<ReturnType<typeof getAdminUser>>>;

function parseList(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function exerciseFields(formData: FormData) {
  const difficulty = String(formData.get("difficulty_level") ?? "").trim();

  return {
    name: String(formData.get("name") ?? "").trim(),
    external_id: String(formData.get("external_id") ?? "").trim() || null,
    primary_muscles: parseList(formData.get("primary_muscles")),
    secondary_muscles: parseList(formData.get("secondary_muscles")),
    equipment: parseList(formData.get("equipment")),
    difficulty_level: difficulty || null,
    instructions: String(formData.get("instructions") ?? "").trim() || null,
    video_url: String(formData.get("video_url") ?? "").trim() || null,
  };
}

async function uploadImage(
  supabase: AdminContext["supabase"],
  exerciseId: string,
  file: File
): Promise<{ publicUrl: string } | { error: string }> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `exercises/${exerciseId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("exercise-media")
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) return { error: uploadError.message };

  const { data } = supabase.storage.from("exercise-media").getPublicUrl(path);

  await supabase.from("exercise_media_assets").upsert(
    {
      exercise_id: exerciseId,
      kind: "image",
      purpose: "thumbnail",
      source: "curated",
      status: "active",
      storage_bucket: "exercise-media",
      storage_path: path,
      public_url: data.publicUrl,
      content_type: file.type || null,
      file_size_bytes: file.size,
      alt_text: null,
    },
    { onConflict: "storage_bucket,storage_path" }
  );

  return { publicUrl: data.publicUrl };
}

export async function createExercise(formData: FormData) {
  const admin = await getAdminUser();
  if (!admin) redirect("/login");

  const fields = exerciseFields(formData);

  if (!fields.name || fields.primary_muscles.length === 0) {
    redirect(
      "/exercises/new?error=Name%20and%20primary%20muscles%20are%20required"
    );
  }

  const { data, error } = await admin.supabase
    .from("exercises")
    .insert(fields)
    .select("id")
    .single();

  if (error) {
    redirect(`/exercises/new?error=${encodeURIComponent(error.message)}`);
  }

  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    const result = await uploadImage(admin.supabase, data.id, image);
    if ("publicUrl" in result) {
      await admin.supabase
        .from("exercises")
        .update({ image_url: result.publicUrl })
        .eq("id", data.id);
    }
  }

  revalidatePath("/exercises");
  redirect(`/exercises/${data.id}`);
}

export async function updateExercise(formData: FormData) {
  const admin = await getAdminUser();
  if (!admin) redirect("/login");

  const id = String(formData.get("id"));
  const fields = exerciseFields(formData);

  const { error } = await admin.supabase
    .from("exercises")
    .update(fields)
    .eq("id", id);

  if (error) {
    redirect(`/exercises/${id}?error=${encodeURIComponent(error.message)}`);
  }

  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    const result = await uploadImage(admin.supabase, id, image);
    if ("publicUrl" in result) {
      await admin.supabase
        .from("exercises")
        .update({ image_url: result.publicUrl })
        .eq("id", id);
    }
  }

  revalidatePath("/exercises");
  revalidatePath(`/exercises/${id}`);
  redirect(`/exercises/${id}?saved=1`);
}

export async function deleteExercise(formData: FormData) {
  const admin = await getAdminUser();
  if (!admin) redirect("/login");

  const id = String(formData.get("id"));

  const { error } = await admin.supabase
    .from("exercises")
    .delete()
    .eq("id", id);

  if (error) {
    redirect(
      `/exercises/${id}?error=${encodeURIComponent(
        "Could not delete exercise. It may still be referenced by workouts: " +
          error.message
      )}`
    );
  }

  revalidatePath("/exercises");
  redirect("/exercises?deleted=1");
}
