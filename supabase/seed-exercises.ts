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
  exercise_type: "weight";
  primary_muscles: string[];
  secondary_muscles: string[];
  equipment: string[];
  difficulty_level: string | null;
  instructions: string | null;
  image_url: string | null;
  video_url: string | null;
}

interface ExerciseTranslationSeed {
  external_id?: string;
  match_external_ids?: string[];
  name?: string;
  pl_name?: string;
  instructions: string | null;
}

interface ExerciseTranslationRow {
  exercise_id: string;
  language_code: "pl";
  name: string;
  instructions: string | null;
  source: "curated";
}

interface ExerciseLookupRow {
  id: string;
  external_id: string | null;
  name: string;
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
      exercise_type: "weight",
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

function loadPolishTranslations(): ExerciseTranslationSeed[] {
  const filePath = path.join(
    __dirname,
    "data",
    "exercise-translations.pl.json"
  );
  if (!fs.existsSync(filePath)) {
    console.warn(`Polish translation file not found: ${filePath}`);
    return [];
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as ExerciseTranslationSeed[];
}

function normalizeExerciseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(
      /\b(barbell|dumbbell|dumbbells|cable|machine|standing|seated|lying)\b/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

function getNameTokens(name: string): Set<string> {
  return new Set(normalizeExerciseName(name).split(" ").filter(Boolean));
}

function findLikelyMatches(
  seedName: string,
  exercises: ExerciseLookupRow[],
  limit = 3
): ExerciseLookupRow[] {
  const seedTokens = getNameTokens(seedName);
  if (seedTokens.size === 0) return [];

  return exercises
    .map((exercise) => {
      const exerciseTokens = getNameTokens(exercise.name);
      let overlap = 0;

      for (const token of seedTokens) {
        if (exerciseTokens.has(token)) overlap += 1;
      }

      const score = overlap / Math.max(seedTokens.size, exerciseTokens.size, 1);
      return { exercise, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ exercise }) => exercise);
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

async function upsertPolishTranslations(
  seeds: ExerciseTranslationSeed[]
): Promise<void> {
  if (seeds.length === 0) return;

  console.log(`Preparing ${seeds.length} Polish exercise translations...`);

  const externalIds = seeds
    .flatMap((seed) => [
      ...(seed.external_id ? [seed.external_id] : []),
      ...(seed.match_external_ids ?? []),
    ])
    .filter((value): value is string => !!value);
  const names = seeds
    .map((seed) => seed.name)
    .filter((value): value is string => !!value);

  const [byExternalIdResult, byNameResult, allExercisesResult] =
    await Promise.all([
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
      supabase.from("exercises").select("id, external_id, name"),
    ]);

  if (byExternalIdResult.error) throw byExternalIdResult.error;
  if (byNameResult.error) throw byNameResult.error;
  if (allExercisesResult.error) throw allExercisesResult.error;

  const byExternalId = new Map<string, ExerciseLookupRow>();
  for (const row of byExternalIdResult.data ?? []) {
    if (row.external_id) byExternalId.set(row.external_id, row);
  }

  const byName = new Map<string, ExerciseLookupRow>();
  for (const row of byNameResult.data ?? []) {
    byName.set(row.name, row);
  }

  const byNormalizedName = new Map<string, ExerciseLookupRow[]>();
  const allExercises = (allExercisesResult.data ?? []) as ExerciseLookupRow[];
  for (const row of allExercises) {
    const normalized = normalizeExerciseName(row.name);
    const existing = byNormalizedName.get(normalized) ?? [];
    existing.push(row);
    byNormalizedName.set(normalized, existing);
  }

  const rows: ExerciseTranslationRow[] = [];
  const unmatched: ExerciseTranslationSeed[] = [];
  for (const seed of seeds) {
    const externalIdMatches = [
      ...(seed.external_id ? [seed.external_id] : []),
      ...(seed.match_external_ids ?? []),
    ]
      .map((externalId) => byExternalId.get(externalId))
      .filter((exercise): exercise is ExerciseLookupRow => !!exercise);
    const normalizedMatches = seed.name
      ? (byNormalizedName.get(normalizeExerciseName(seed.name)) ?? [])
      : [];
    const fallbackExercise =
      (seed.name ? byName.get(seed.name) : undefined) ??
      (normalizedMatches.length === 1 ? normalizedMatches[0] : undefined);
    const matchedExercises =
      externalIdMatches.length > 0
        ? externalIdMatches
        : fallbackExercise
          ? [fallbackExercise]
          : [];
    const translatedName = seed.pl_name ?? seed.name;

    if (matchedExercises.length === 0 || !translatedName) {
      unmatched.push(seed);
      continue;
    }

    for (const exercise of matchedExercises) {
      rows.push({
        exercise_id: exercise.id,
        language_code: "pl",
        name: translatedName,
        instructions: seed.instructions,
        source: "curated",
      });
    }
  }

  const dedupedRows = Array.from(
    rows
      .reduce((acc, row) => {
        acc.set(`${row.exercise_id}:${row.language_code}`, row);
        return acc;
      }, new Map<string, ExerciseTranslationRow>())
      .values()
  );

  if (dedupedRows.length === 0) {
    console.warn("No Polish translations matched seeded exercises.");
    return;
  }

  if (unmatched.length > 0) {
    console.warn(
      `${unmatched.length} Polish translations did not match any exercise:`
    );
    for (const seed of unmatched.slice(0, 20)) {
      const candidates = seed.name
        ? findLikelyMatches(seed.name, allExercises)
        : [];
      const candidateText =
        candidates.length > 0
          ? ` | candidates: ${candidates
              .map(
                (candidate) =>
                  `${candidate.external_id ?? "no-id"}:${candidate.name}`
              )
              .join("; ")}`
          : "";
      console.warn(
        `  - ${seed.external_id ?? "(no external_id)"} / ${seed.name ?? seed.pl_name ?? "(no name)"}${candidateText}`
      );
    }
    if (unmatched.length > 20) {
      console.warn(`  ...and ${unmatched.length - 20} more`);
    }
  }

  const { error } = await supabase
    .from("exercise_translations")
    .upsert(dedupedRows, { onConflict: "exercise_id,language_code" });

  if (error) {
    console.error("Polish translation upsert failed:", error.message);
    throw error;
  }

  console.log(
    `Successfully upserted ${dedupedRows.length} Polish translations.`
  );
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
  await upsertPolishTranslations(loadPolishTranslations());
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
