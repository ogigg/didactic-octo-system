/**
 * Exercise media seeding script.
 *
 * Uploads reviewed exercise illustration files to Supabase Storage and upserts
 * matching metadata into `exercise_media_assets`.
 *
 * Usage:
 *   npx tsx supabase/seed-exercise-media.ts
 *
 * Requires environment variables:
 *   SUPABASE_URL          – Supabase project URL
 *   SUPABASE_SERVICE_KEY  – service_role key (bypasses RLS)
 */

import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing env vars. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const BUCKET = "exercise-media";
const MANIFEST_PATH = path.join(
  __dirname,
  "data",
  "exercise-media-manifest.json"
);

interface ExerciseMediaManifestItem {
  exercise_name: string;
  external_ids?: string[];
  purpose: "thumbnail" | "hero" | "step" | "animated" | "video";
  file: string;
  width: number;
  height: number;
  source: "curated" | "imported" | "generated" | "placeholder";
  license: string;
  alt_text: string;
}

interface ExerciseLookupRow {
  id: string;
  external_id: string | null;
  name: string;
}

interface ExerciseMediaRow {
  exercise_id: string;
  kind: "image";
  purpose: ExerciseMediaManifestItem["purpose"];
  source: ExerciseMediaManifestItem["source"];
  status: "active";
  storage_bucket: string;
  storage_path: string;
  public_url: string;
  width: number;
  height: number;
  content_type: string;
  file_size_bytes: number;
  alt_text: string;
  license: string;
  checksum_sha256: string;
}

function loadManifest(): ExerciseMediaManifestItem[] {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`Manifest file not found: ${MANIFEST_PATH}`);
    process.exit(1);
  }

  return JSON.parse(
    fs.readFileSync(MANIFEST_PATH, "utf-8")
  ) as ExerciseMediaManifestItem[];
}

function contentTypeForFile(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  throw new Error(`Unsupported media file extension: ${filePath}`);
}

function normalizeExerciseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function loadExerciseLookup(
  manifest: ExerciseMediaManifestItem[]
): Promise<Map<ExerciseMediaManifestItem, ExerciseLookupRow>> {
  const externalIds = manifest
    .flatMap((item) => item.external_ids ?? [])
    .filter((value): value is string => !!value);
  const names = manifest.map((item) => item.exercise_name);

  const [byExternalIdResult, byNameResult] = await Promise.all([
    externalIds.length
      ? supabase
          .from("exercises")
          .select("id, external_id, name")
          .in("external_id", externalIds)
      : Promise.resolve({ data: [], error: null }),
    names.length
      ? supabase
          .from("exercises")
          .select("id, external_id, name")
          .in("name", names)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (byExternalIdResult.error) throw byExternalIdResult.error;
  if (byNameResult.error) throw byNameResult.error;

  const byExternalId = new Map<string, ExerciseLookupRow>();
  for (const row of byExternalIdResult.data ?? []) {
    if (row.external_id) byExternalId.set(row.external_id, row);
  }

  const byName = new Map<string, ExerciseLookupRow>();
  const byNormalizedName = new Map<string, ExerciseLookupRow>();
  for (const row of byNameResult.data ?? []) {
    byName.set(row.name, row);
    byNormalizedName.set(normalizeExerciseName(row.name), row);
  }

  const result = new Map<ExerciseMediaManifestItem, ExerciseLookupRow>();
  const unmatched: ExerciseMediaManifestItem[] = [];

  for (const item of manifest) {
    const externalMatch = (item.external_ids ?? [])
      .map((externalId) => byExternalId.get(externalId))
      .find((row): row is ExerciseLookupRow => !!row);
    const nameMatch =
      byName.get(item.exercise_name) ??
      byNormalizedName.get(normalizeExerciseName(item.exercise_name));
    const match = externalMatch ?? nameMatch;

    if (match) {
      result.set(item, match);
    } else {
      unmatched.push(item);
    }
  }

  if (unmatched.length > 0) {
    console.warn(`${unmatched.length} media manifest items were unmatched:`);
    for (const item of unmatched) {
      console.warn(`  - ${item.exercise_name} (${item.file})`);
    }
  }

  return result;
}

async function main(): Promise<void> {
  const manifest = loadManifest();
  const exerciseLookup = await loadExerciseLookup(manifest);
  const rows: ExerciseMediaRow[] = [];
  const thumbnailBackfills: { exerciseId: string; imageUrl: string }[] = [];

  for (const item of manifest) {
    const exercise = exerciseLookup.get(item);
    if (!exercise) continue;

    const localPath = path.join(__dirname, item.file);
    if (!fs.existsSync(localPath)) {
      throw new Error(`Media file not found: ${localPath}`);
    }

    const contentType = contentTypeForFile(localPath);
    const fileBuffer = fs.readFileSync(localPath);
    const checksum = createHash("sha256").update(fileBuffer).digest("hex");
    const ext = path.extname(item.file).toLowerCase();
    const storagePath = `exercises/${exercise.id}/${item.purpose}${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Failed to upload ${item.file}: ${uploadError.message}`);
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

    rows.push({
      exercise_id: exercise.id,
      kind: "image",
      purpose: item.purpose,
      source: item.source,
      status: "active",
      storage_bucket: BUCKET,
      storage_path: storagePath,
      public_url: publicUrl,
      width: item.width,
      height: item.height,
      content_type: contentType,
      file_size_bytes: fileBuffer.byteLength,
      alt_text: item.alt_text,
      license: item.license,
      checksum_sha256: checksum,
    });

    if (item.purpose === "thumbnail") {
      thumbnailBackfills.push({ exerciseId: exercise.id, imageUrl: publicUrl });
    }
  }

  if (rows.length === 0) {
    console.warn("No media rows to upsert.");
    return;
  }

  const { error: upsertError } = await supabase
    .from("exercise_media_assets")
    .upsert(rows, { onConflict: "storage_bucket,storage_path" });

  if (upsertError) {
    throw upsertError;
  }

  for (const backfill of thumbnailBackfills) {
    const { error } = await supabase
      .from("exercises")
      .update({ image_url: backfill.imageUrl })
      .eq("id", backfill.exerciseId);

    if (error) throw error;
  }

  console.log(`Successfully seeded ${rows.length} exercise media assets.`);
}

main().catch((err) => {
  console.error("Exercise media seeding failed:", err);
  process.exit(1);
});
