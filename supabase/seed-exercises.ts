/**
 * Exercise seeding script.
 *
 * Fetches exercises from the free WGER API and inserts them into the
 * `exercises` table. Falls back to a local JSON file when the API is
 * unavailable.
 *
 * Usage:
 *   npx tsx supabase/seed-exercises.ts
 *
 * Requires environment variables:
 *   SUPABASE_URL         – Supabase project URL
 *   SUPABASE_SERVICE_KEY  – service_role key (bypasses RLS)
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing env vars. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const WGER_BASE = "https://wger.de/api/v2";
const BATCH_SIZE = 50;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WgerTranslation {
  language: number;
  name: string;
  description: string;
}

interface WgerMuscleObj {
  id: number;
  name: string;
  name_en: string;
}

interface WgerEquipmentObj {
  id: number;
  name: string;
}

interface WgerExerciseInfo {
  id: number;
  uuid: string;
  muscles: WgerMuscleObj[];
  muscles_secondary: WgerMuscleObj[];
  equipment: WgerEquipmentObj[];
  translations: WgerTranslation[];
}

interface ExerciseRow {
  name: string;
  external_id: string;
  primary_muscles: string[];
  secondary_muscles: string[];
  equipment: string[];
  difficulty_level: string | null;
  instructions: string | null;
  image_url: string | null;
  video_url: string | null;
}

// ---------------------------------------------------------------------------
// WGER API helpers
// ---------------------------------------------------------------------------

async function fetchAllPages<T>(endpoint: string): Promise<T[]> {
  const results: T[] = [];
  let url: string | null = `${WGER_BASE}${endpoint}`;

  while (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`WGER API error: ${res.status} ${url}`);
    const json = await res.json();
    results.push(...json.results);
    url = json.next;
  }

  return results;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const ENGLISH_LANGUAGE_ID = 2;

async function seedFromApi(): Promise<ExerciseRow[]> {
  console.log("Fetching exercises from WGER exerciseinfo...");
  const exercises = await fetchAllPages<WgerExerciseInfo>(
    "/exerciseinfo/?format=json&language=2&limit=100"
  );

  console.log(`Fetched ${exercises.length} exercises from WGER.`);

  const valid = exercises.filter((e) => {
    const translation = e.translations.find(
      (t) => t.language === ENGLISH_LANGUAGE_ID && t.name?.trim().length > 0
    );
    return translation && e.muscles.length > 0;
  });

  console.log(`${valid.length} exercises have names and muscle data.`);

  return valid.map((e) => {
    const translation = e.translations.find(
      (t) => t.language === ENGLISH_LANGUAGE_ID
    )!;
    return {
      name: translation.name.trim(),
      external_id: `wger-${e.id}`,
      primary_muscles: e.muscles.map((m) => m.name_en || m.name),
      secondary_muscles: e.muscles_secondary.map((m) => m.name_en || m.name),
      equipment: e.equipment.map((eq) => eq.name),
      difficulty_level: null,
      instructions: translation.description
        ? stripHtml(translation.description)
        : null,
      image_url: null,
      video_url: null,
    };
  });
}

function loadFallback(): ExerciseRow[] {
  const filePath = path.join(__dirname, "data", "exercises.json");
  if (!fs.existsSync(filePath)) {
    console.error(`Fallback file not found: ${filePath}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as ExerciseRow[];
}

async function upsertExercises(rows: ExerciseRow[]): Promise<void> {
  console.log(
    `Upserting ${rows.length} exercises in batches of ${BATCH_SIZE}...`
  );

  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("exercises")
      .upsert(batch, { onConflict: "external_id" });

    if (error) {
      console.error(`Batch ${i / BATCH_SIZE + 1} failed:`, error.message);
      throw error;
    }
    inserted += batch.length;
    console.log(`  ${inserted}/${rows.length} done`);
  }

  console.log(`Successfully upserted ${inserted} exercises.`);
}

async function main(): Promise<void> {
  let exercises: ExerciseRow[];

  try {
    exercises = await seedFromApi();
  } catch (err) {
    console.warn("WGER API failed, falling back to local JSON:", err);
    exercises = loadFallback();
  }

  if (exercises.length === 0) {
    console.error("No exercises to seed.");
    process.exit(1);
  }

  await upsertExercises(exercises);
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
