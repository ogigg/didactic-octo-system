# Exercise Media Database Seeding

arc42-style guide for adding reviewed exercise images to the database-backed media catalog.

## 1. Introduction and Goals

### Requirements Overview

Exercise illustrations are stored as files in Supabase Storage and exposed to the app through `exercise_media_assets`.

The goal of this workflow is to:

- register reviewed exercise images in the media manifest
- upload image files to the public `exercise-media` Supabase Storage bucket
- upsert metadata into `exercise_media_assets`
- backfill `exercises.image_url` for thumbnail images
- keep generated or curated media traceable through source, license, checksum, and alt text

### Quality Goals

- Exercise media must match an existing `exercises` row.
- Images must be reviewed before being marked active.
- Seeding must be repeatable and idempotent.
- Service-role writes must stay explicit and controlled.
- User-facing exercise lookups must continue to work through existing RPCs.

### Stakeholders

| Role           | Interest                                                                           |
| -------------- | ---------------------------------------------------------------------------------- |
| App users      | See correct, accessible exercise illustrations.                                    |
| Product/Design | Keep exercise media consistent and reviewed.                                       |
| Engineering    | Maintain a reproducible seeding workflow with low risk of mismatched catalog data. |

## 2. Architecture Constraints

- The canonical database schema lives in `supabase/migrations`.
- Exercise media metadata lives in `exercise_media_assets`.
- Compatibility thumbnail URLs are also copied to `exercises.image_url`.
- The seeder requires `SUPABASE_SERVICE_KEY`; the anon key cannot perform this write path.
- The public storage bucket is `exercise-media`.
- Supported image MIME types are `image/png`, `image/jpeg`, and `image/webp`.
- Storage object size is limited to 5 MiB for the `exercise-media` bucket.
- Do not run the seeder unless you intend to mutate the target Supabase project.

## 3. System Scope and Context

### Existing Files

| Path                                                               | Purpose                                                              |
| ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `supabase/seed-exercise-media.ts`                                  | Uploads files and upserts media rows.                                |
| `supabase/data/exercise-media-manifest.json`                       | Manifest consumed by the seeding script.                             |
| `supabase/assets/exercise-media/`                                  | Local source images for seeded exercise media.                       |
| `supabase/assets/exercise-media/generated-2026-06/manifest.json`   | Generated image manifest; not consumed directly by the seeder.       |
| `supabase/migrations/20260522000000_add_exercise_media_assets.sql` | Storage bucket, policies, table, indexes, and RPC media projections. |
| `.ai/db-schema.md`                                                 | Human-readable database reference.                                   |

### Runtime Context

The mobile app reads exercise images through localized exercise RPCs. Those RPCs prefer active rows in `exercise_media_assets` and fall back to `exercises.image_url` when needed.

## 4. Solution Strategy

1. Put reviewed image files under `supabase/assets/exercise-media/`.
2. Add corresponding entries to `supabase/data/exercise-media-manifest.json`.
3. Match each manifest entry to a real DB exercise by `external_ids` or exact canonical `exercise_name`.
4. Run the seeder with service-role credentials.
5. Review seeder warnings for unmatched items.
6. Verify inserted rows and public URLs in Supabase.

## 5. Building Block View

### Manifest Item

Each manifest item must follow this shape:

```json
{
  "exercise_name": "Barbell Bench Press",
  "external_ids": ["fallback-1", "wger-73"],
  "purpose": "thumbnail",
  "file": "assets/exercise-media/generated-2026-06/flat-barbell-bench-press.png",
  "width": 1536,
  "height": 1536,
  "source": "generated",
  "license": "owned",
  "alt_text": "Athletic adult lying on a flat bench pressing a barbell upward with chest highlighted."
}
```

### Required Fields

| Field              | Notes                                                              |
| ------------------ | ------------------------------------------------------------------ |
| `exercise_name`    | Canonical DB exercise name. Used as a fallback match key.          |
| `external_ids`     | Preferred match key. Include all known matching IDs when possible. |
| `purpose`          | One of `thumbnail`, `hero`, `step`, `animated`, `video`.           |
| `file`             | Path relative to `supabase/`.                                      |
| `width` / `height` | Positive image dimensions in pixels.                               |
| `source`           | One of `curated`, `imported`, `generated`, `placeholder`.          |
| `license`          | Ownership or license label.                                        |
| `alt_text`         | Accessible description for the exercise image.                     |

## 6. Runtime View

### Seeder Flow

1. Load `supabase/data/exercise-media-manifest.json`.
2. Query `exercises` by manifest `external_ids` and `exercise_name`.
3. Read each local image file.
4. Compute SHA-256 checksum.
5. Upload to `exercise-media` storage at:

```text
exercises/{exercise_id}/{purpose}.{ext}
```

6. Generate the public storage URL.
7. Upsert an `exercise_media_assets` row using `storage_bucket,storage_path` as the conflict key.
8. For `thumbnail` entries, update `exercises.image_url`.

### Matching Rules

Prefer `external_ids`. Name matching is fragile because generated image names may be more specific than catalog names.

Examples from the local fallback catalog:

| Generated image name                      | Likely catalog name     |
| ----------------------------------------- | ----------------------- |
| `Flat Barbell Bench Press`                | `Barbell Bench Press`   |
| `Leg Press Machine`                       | `Leg Press`             |
| `Conventional Barbell Deadlift`           | `Conventional Deadlift` |
| `Dumbbell Hammer Curl`                    | `Hammer Curl`           |
| `Cable Triceps Pushdown with Rope or Bar` | `Tricep Pushdown`       |
| `Forearm Plank`                           | `Plank`                 |

## 7. Deployment View

### Prerequisites

- Target Supabase project has the `exercise_media_assets` migration applied.
- Target Supabase project has an `exercise-media` storage bucket.
- Target `exercises` table already contains the exercises referenced by the manifest.
- Local dependencies are installed.
- You have the target project URL and service-role key.

### Mutating Command

Only run this when you intend to upload files and write DB rows:

```bash
SUPABASE_URL="https://your-project.supabase.co" \
SUPABASE_SERVICE_KEY="your-service-role-key" \
npx tsx supabase/seed-exercise-media.ts
```

Expected successful output:

```text
Successfully seeded N exercise media assets.
```

Unmatched entries are printed as warnings. Fix those by updating `external_ids` or `exercise_name` in the manifest, then rerun the command.

## 8. Cross-Cutting Concepts

### Access Control

- Authenticated users can read active media rows.
- Service role owns media writes.
- Storage writes are restricted to service role for the `exercise-media` bucket.

### Idempotency

The script is repeatable:

- Storage upload uses `upsert: true`.
- DB upsert uses the unique key `storage_bucket,storage_path`.
- Thumbnail backfill updates `exercises.image_url` to the current public URL.

### Active Media Constraints

Database indexes enforce:

- one active thumbnail image per exercise
- one active hero image per exercise

Do not add multiple active manifest entries with the same `purpose` for the same exercise unless the previous row is archived or replaced.

## 9. Architecture Decisions

| Decision                                  | Rationale                                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------------- |
| Store files in Supabase Storage           | Exercise catalog media is static, public, and should not be embedded in the database. |
| Store metadata in `exercise_media_assets` | Supports richer media metadata than legacy `exercises.image_url`.                     |
| Keep `exercises.image_url` backfill       | Preserves compatibility with older code paths and fallback reads.                     |
| Use service-role seeding                  | Avoids broad client write permissions for catalog-owned assets.                       |
| Use manifest-driven imports               | Keeps media imports reviewable in git.                                                |

## 10. Quality Requirements

Before running the seeder:

- Confirm each image is reviewed.
- Confirm every manifest `file` exists.
- Confirm every manifest item maps to a real exercise.
- Confirm image dimensions are correct.
- Confirm source and license values are accurate.
- Confirm alt text describes the exercise and relevant visual emphasis.

After running the seeder:

- Check for unmatched warning output.
- Verify `exercise_media_assets.status = 'active'`.
- Verify `public_url` resolves.
- Verify the app shows the expected exercise image.

## 11. Risks and Technical Debt

- Generated image names may not match canonical exercise names.
- Missing `external_ids` can silently reduce match quality.
- Running against the wrong Supabase project will upload media to the wrong environment.
- Reusing `thumbnail` or `hero` purpose for the same exercise can conflict with unique active-media constraints.
- Large files above 5 MiB will fail storage upload.

## 12. Useful Verification Queries

Read-only checks:

```sql
select id, name, external_id
from exercises
where name ilike '%bench%'
order by name;
```

```sql
select
  e.name,
  ema.purpose,
  ema.status,
  ema.public_url,
  ema.width,
  ema.height,
  ema.source
from exercise_media_assets ema
join exercises e on e.id = ema.exercise_id
order by e.name, ema.purpose;
```

```sql
select name, image_url
from exercises
where image_url is not null
order by name;
```

## 13. Glossary

| Term                    | Meaning                                                            |
| ----------------------- | ------------------------------------------------------------------ |
| `exercise-media`        | Public Supabase Storage bucket for exercise catalog media.         |
| `exercise_media_assets` | Metadata table for reviewed exercise media.                        |
| `thumbnail`             | Small/default image used by exercise lists and cards.              |
| `hero`                  | Primary larger image for detail-oriented surfaces.                 |
| `external_id`           | Stable imported or fallback exercise identifier used for matching. |
| `service_role`          | Supabase key role that bypasses RLS and can seed catalog data.     |
