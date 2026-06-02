# Workout Illustration Images Implementation Report

## Scope

This report reviews the current repository and proposes a concrete implementation plan for adding workout illustration images across the app, API, Supabase Edge Functions, storage, infra, and database.

Product framing follows `PROJECT.md`: images should strengthen the core training loop by making generated workouts easier to trust and execute quickly, especially in-session. The recommendation is therefore to start with stable exercise illustration assets, not AI-generating new imagery per workout.

## Current-State Analysis

### Product and architecture context

The app is an early product expansion mobile-first AI workout app. The important loop is:

1. collect setup and training preferences
2. generate or prepare the next workout
3. guide the user through execution
4. log performance and feedback
5. use that data for future workouts

Workout illustrations are valuable if they reduce ambiguity at steps 2 and 3, improve exercise selection confidence, and make the `exercise-detail` how-to surface more useful.

### Existing media support in the database

The initial workout schema already includes nullable media columns on `exercises`:

```sql
image_url TEXT,
video_url TEXT
```

Those fields are present in `supabase/migrations/20260322000000_add_workout_tables.sql` and documented in `.ai/db-schema.md`. The localized catalog RPC in `supabase/migrations/20260512000000_add_exercise_translations.sql` already returns:

```sql
'image_url', e.image_url,
'video_url', e.video_url
```

The mobile catalog schema in `apps/mobile/lib/api/exercises.ts` also parses both fields:

```ts
image_url: z.string().nullable(),
video_url: z.string().nullable(),
```

This means catalog fetches can already return media URLs. The missing pieces are domain semantics, storage backing, URL strategy, richer metadata, workout response propagation, UI rendering, and asset population.

### Existing seed/import flow

`supabase/seed-exercises.ts` imports WGER exercise data and currently sets:

```ts
image_url: null,
video_url: null,
```

The local fallback JSON also appears to be catalog-focused rather than media-backed. There is no current script for uploading assets, generating variants, validating dimensions, or maintaining Supabase Storage paths.

### Existing storage/infra state

`supabase/config.toml` has a commented example bucket:

```toml
# [storage.buckets.images]
# public = false
# file_size_limit = "50MiB"
# allowed_mime_types = ["image/png", "image/jpeg"]
```

No app code currently calls `supabase.storage.from(...)`, `createSignedUrl(...)`, or object download APIs. There is no active bucket definition, no storage RLS policy migration, and no URL helper.

### Existing workout generation data flow

The server-side generator is centered in `supabase/functions/_shared/generator.ts`.

The current flow is:

1. Edge function receives authenticated request in `generate-workout`, `generate-workout-queue`, or `generate-next-workout`.
2. It fetches profile, training preferences, recent history, baselines, exercise preferences, queue context, and recent comments.
3. `generateSingleWorkout()` calls `fetchExerciseCatalog()`.
4. `fetchExerciseCatalog()` selects only:

```ts
"id, name, exercise_type, primary_muscles, secondary_muscles, equipment, difficulty_level";
```

5. The prompt includes exercise id, name, type, muscles, equipment, and difficulty.
6. The LLM returns exercise IDs, set targets, rest, and notes.
7. The generator validates IDs against the catalog, substitutes invalid IDs, and enriches each exercise with:

```ts
exercise_id;
exercise_name;
exercise_type;
sets;
rest_duration_seconds;
notes;
progression_type;
previous_display;
```

8. The response is stored directly in `pending_workouts.workout_data` for queued workouts, or returned to the mobile app for direct generation.

Important current gap: media is not selected in the generation catalog and is not included in generated workout payloads. That is reasonable for LLM generation because the LLM should not choose or invent media, but the backend should enrich selected exercise IDs with canonical media metadata before returning/persisting.

### Existing pending workout data flow

`pending_workouts.workout_data` stores the generated workout payload as JSONB. Mobile validates that payload with `generateWorkoutResponseSchema` from `apps/mobile/lib/api/generate-workout.ts`.

The pending preview screen:

- reads `PendingWorkout.workout_data`
- initializes local editable exercises from `workout_data.exercises` or `user_edits.exercises`
- renders a local `ExerciseCard` inside `apps/mobile/app/workout-preview.tsx`
- starts a workout through `useStartPendingWorkout()`

Current gap: if media is added to `workout_data.exercises`, it must be accepted by the mobile Zod schema and preserved through user edits, local preview state, start-workout mapping, and active workout store.

### Existing active workout display flow

The active workout store in `apps/mobile/stores/workout-store.ts` stores each exercise as:

```ts
id;
name;
exerciseType;
restDurationSeconds;
notes;
difficultyFeedback;
sets;
progressionType;
```

No media fields are persisted in the in-progress workout state.

The active workout screen `apps/mobile/app/workout.tsx` fetches localized exercise rows for active exercise IDs through `useLocalizedExerciseMap()`, then passes only `displayName` to `ExerciseCard`.

`apps/mobile/components/workout/exercise-card.tsx` renders a 44x44 `imagePlaceholder`, but does not render an actual image. This is the most direct active-session insertion point.

### Existing exercise detail flow

`apps/mobile/app/exercise-detail.tsx` fetches catalog metadata with `useExercise()` and performance/history with `useExerciseDetail()`.

The `howTo` tab currently renders only instructions and a placeholder todo message when instructions are absent. It does not render images or video.

This is the most useful full-size illustration surface because the user is explicitly seeking guidance, and the screen already has a how-to tab.

### Existing exercise picker flow

`apps/mobile/components/exercise-picker/exercise-row.tsx` renders name, primary muscle, and an action icon. It receives full `Exercise` objects that already include `image_url` and `video_url`, but it does not display media.

Images here should be optional and small, because the picker is a scanning tool. A thumbnail can improve recognition, but it must not slow filtering or crowd the row.

### Existing i18n conventions

User-facing strings live under `apps/mobile/i18n/locales/en/` and `apps/mobile/i18n/locales/pl/`. Media-related accessibility labels, load failure text, alt text fallbacks, and how-to headings should be added to the appropriate namespace files, likely:

- `workout.ts`
- `workout-preview.ts`
- `exercise-picker.ts`
- `exercise-detail.ts`
- optionally `common.ts` for shared generic labels

No hardcoded JSX strings should be introduced.

## Recommended Image/Media Domain Model

### Design recommendation

Keep `exercises` as the stable exercise identity table, but move rich media into a normalized media table instead of overloading `image_url` and `video_url`.

The existing columns can remain as backwards-compatible denormalized primary URLs during migration, but the richer model should be:

- one exercise can have multiple media assets
- one asset has a purpose, format, dimensions, source, and lifecycle state
- one asset can expose multiple variants
- app responses should include a compact primary media object, not a raw arbitrary URL string

### Proposed media concepts

Use images for phase one. Add video support later with the same table.

Recommended media purposes:

- `thumbnail`: small square/near-square image for cards and picker rows
- `hero`: larger image for exercise detail
- `step`: optional future how-to step image
- `animated`: optional future GIF/WebP or short loop
- `video`: optional future video

Recommended media sources:

- `curated`: manually approved asset
- `imported`: imported from an external licensed source
- `generated`: generated asset that has passed review
- `placeholder`: app-owned generic fallback

Recommended media status:

- `draft`
- `active`
- `archived`
- `rejected`

### Client-facing media object

Expose media to mobile as:

```ts
interface ExerciseMediaAsset {
  id: string;
  kind: "image" | "video";
  purpose: "thumbnail" | "hero" | "step" | "animated" | "video";
  source: "curated" | "imported" | "generated" | "placeholder";
  storage_bucket: string;
  storage_path: string;
  public_url: string | null;
  signed_url?: string;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  alt_text: string | null;
  attribution: string | null;
}
```

For initial implementation, return only:

```ts
interface ExerciseImage {
  url: string;
  thumbnail_url: string | null;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  blurhash: string | null;
  source: "curated" | "imported" | "generated" | "placeholder";
}
```

The compact object is enough for mobile UX and avoids leaking storage internals into every screen.

### Why not store only URLs on `exercises`

Raw URL columns are too weak for this feature because they do not answer:

- whether the image is licensed or reviewed
- whether it is a thumbnail, hero, step image, or video
- whether it is suitable for public use
- what dimensions/layout to reserve
- how to invalidate/cache variants
- whether there are multiple images per exercise
- whether a broken asset should be hidden

The current `image_url` and `video_url` columns are acceptable as transitional convenience fields, but should not become the long-term media domain model.

## Database Migration Plan

### Phase 1 migration: normalized exercise media

Create a migration such as:

`supabase/migrations/YYYYMMDDHHMMSS_add_exercise_media.sql`

Recommended SQL:

```sql
CREATE TABLE exercise_media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,

  kind TEXT NOT NULL CHECK (kind IN ('image', 'video')),
  purpose TEXT NOT NULL CHECK (purpose IN ('thumbnail', 'hero', 'step', 'animated', 'video')),
  source TEXT NOT NULL CHECK (source IN ('curated', 'imported', 'generated', 'placeholder')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived', 'rejected')),

  storage_bucket TEXT NOT NULL DEFAULT 'exercise-media',
  storage_path TEXT NOT NULL,
  public_url TEXT,

  width INTEGER CHECK (width IS NULL OR width > 0),
  height INTEGER CHECK (height IS NULL OR height > 0),
  content_type TEXT,
  file_size_bytes INTEGER CHECK (file_size_bytes IS NULL OR file_size_bytes > 0),
  blurhash TEXT,

  alt_text TEXT,
  attribution TEXT,
  license TEXT,
  source_url TEXT,
  checksum_sha256 TEXT,

  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT exercise_media_assets_path_unique UNIQUE (storage_bucket, storage_path)
);

CREATE UNIQUE INDEX idx_exercise_media_one_active_thumbnail
  ON exercise_media_assets(exercise_id)
  WHERE kind = 'image' AND purpose = 'thumbnail' AND status = 'active';

CREATE UNIQUE INDEX idx_exercise_media_one_active_hero
  ON exercise_media_assets(exercise_id)
  WHERE kind = 'image' AND purpose = 'hero' AND status = 'active';

CREATE INDEX idx_exercise_media_exercise_active
  ON exercise_media_assets(exercise_id, status, purpose, sort_order);

CREATE TRIGGER exercise_media_assets_updated_at
  BEFORE UPDATE ON exercise_media_assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE exercise_media_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY exercise_media_assets_select_authenticated
  ON exercise_media_assets
  FOR SELECT TO authenticated
  USING (status = 'active');

CREATE POLICY exercise_media_assets_modify_service_role
  ON exercise_media_assets
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
```

Notes:

- The unique partial indexes enforce one active thumbnail and one active hero per exercise.
- Multiple active `step` images can be allowed by omitting a unique index for `purpose = 'step'`.
- `public_url` should be nullable. For public buckets it can be materialized; for private buckets the API should return signed URLs.
- `alt_text` can be English-neutral at first because exercise names are already localized. If media alt text needs localization later, add `exercise_media_translations`.

### Phase 1 RPC updates

Update `get_localized_exercises()` and `get_localized_exercise()` to include a compact `image` object while keeping `image_url` for compatibility:

```sql
'image', (
  SELECT jsonb_build_object(
    'url', COALESCE(hero.public_url, thumb.public_url, e.image_url),
    'thumbnail_url', thumb.public_url,
    'width', COALESCE(hero.width, thumb.width),
    'height', COALESCE(hero.height, thumb.height),
    'alt_text', COALESCE(hero.alt_text, thumb.alt_text),
    'blurhash', COALESCE(hero.blurhash, thumb.blurhash),
    'source', COALESCE(hero.source, thumb.source)
  )
  FROM exercise_media_assets thumb
  FULL JOIN exercise_media_assets hero
    ON hero.exercise_id = e.id
   AND hero.kind = 'image'
   AND hero.purpose = 'hero'
   AND hero.status = 'active'
  WHERE thumb.exercise_id = e.id
    AND thumb.kind = 'image'
    AND thumb.purpose = 'thumbnail'
    AND thumb.status = 'active'
  LIMIT 1
)
```

Prefer a lateral join in the real SQL for readability and planner behavior:

```sql
LEFT JOIN LATERAL (
  SELECT *
  FROM exercise_media_assets ema
  WHERE ema.exercise_id = e.id
    AND ema.kind = 'image'
    AND ema.status = 'active'
  ORDER BY
    CASE ema.purpose WHEN 'hero' THEN 0 WHEN 'thumbnail' THEN 1 ELSE 2 END,
    ema.sort_order,
    ema.created_at
  LIMIT 1
) primary_image ON true
```

Then build:

```sql
'image', CASE
  WHEN primary_image.id IS NULL AND e.image_url IS NULL THEN NULL
  ELSE jsonb_build_object(...)
END
```

### Phase 2 migration: optional generated workout media snapshot

If images are expected to change over time, do not rely exclusively on live exercise joins for historical or pending workouts. Add an optional snapshot in JSON payloads first:

```json
{
  "exercise_id": "...",
  "exercise_name": "Dumbbell Bench Press",
  "exercise_type": "weight",
  "image": {
    "url": "https://...",
    "thumbnail_url": "https://...",
    "alt_text": "Dumbbell bench press setup",
    "source": "curated"
  }
}
```

No table migration is required for this because `pending_workouts.workout_data` is already JSONB and completed sessions can still join `session_exercises.exercise_id` back to the current catalog.

Only add a relational snapshot column if historical image fidelity becomes important:

```sql
ALTER TABLE session_exercises
  ADD COLUMN media_snapshot JSONB;
```

This is not recommended for phase one because it increases persistence complexity without solving the main in-session UX need.

### Backfill plan

1. Create the table and policies.
2. Create `exercise-media` storage bucket.
3. Upload curated thumbnails and hero images under deterministic paths.
4. Insert `exercise_media_assets` rows for each uploaded object.
5. Optionally backfill `exercises.image_url` from the active thumbnail public URL for compatibility.
6. Update RPCs and mobile schemas.
7. Keep null media valid indefinitely.

### `.ai/db-schema.md` update

When implementing, update `.ai/db-schema.md` with:

- `exercise_media_assets` purpose and columns
- relationship to `exercises`
- active asset uniqueness expectations
- storage bucket policy assumptions
- note that `exercises.image_url`/`video_url` are legacy/compatibility shortcuts if retained

## Supabase Storage / Infra Plan

### Bucket strategy

Recommended bucket:

```toml
[storage.buckets.exercise-media]
public = true
file_size_limit = "5MiB"
allowed_mime_types = ["image/png", "image/jpeg", "image/webp"]
objects_path = "./exercise-media"
```

Use a public bucket for phase one. Exercise illustrations are not user-private, and public URLs simplify mobile caching, offline behavior, and Expo image loading. A private bucket with signed URLs adds token expiration, cache invalidation, and edge-function signing complexity without meaningful privacy benefit for canonical exercise images.

Recommended path structure:

```text
exercise-media/
  exercises/
    {exercise_id}/
      thumb.webp
      hero.webp
      steps/
        01.webp
        02.webp
```

If source assets should be retained:

```text
exercise-media-source/
  imported/{source}/{external_id}/original.jpg
```

Keep source/original bucket private if licenses require it. Serve only reviewed derivatives publicly.

### Storage RLS and write access

For a public read bucket, users can fetch images by URL without Storage RLS reads. Writes should be service-role only.

Add a migration that inserts the bucket and storage policies:

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'exercise-media',
  'exercise-media',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "exercise media public read"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'exercise-media');

CREATE POLICY "exercise media service writes"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'exercise-media')
WITH CHECK (bucket_id = 'exercise-media');
```

If anonymous users can reach authenticated app screens only after login, authenticated read is enough at the database layer. Public bucket URLs will still be publicly retrievable; that is acceptable for non-private catalog assets.

### Image sizes

Generate and store:

- `thumb.webp`: 160x160 or 192x192, square crop, used in picker and active cards
- `hero.webp`: 1024x768 or 1200x900, 4:3, used in exercise detail
- optional `hero@2x.webp` if image quality is poor on high-density devices

Avoid very tall or transparent-only assets. Mobile UI should reserve aspect-ratio boxes to avoid layout shift.

### Image transformation

`supabase/config.toml` notes that Supabase image transformation requires a Pro plan. Do not make app rendering depend on transformations unless the project confirms plan availability. Pre-generate variants during seeding/import instead.

### Asset import script

Add a script such as:

`supabase/seed-exercise-media.ts`

Responsibilities:

- read a manifest file
- verify every `exercise_id` exists
- verify local file existence, MIME type, dimensions, and file size
- upload derivatives to `exercise-media`
- upsert `exercise_media_assets`
- optionally update `exercises.image_url`

Manifest example:

```json
[
  {
    "exercise_id": "uuid",
    "purpose": "thumbnail",
    "file": "assets/exercise-media/uuid/thumb.webp",
    "width": 192,
    "height": 192,
    "source": "curated",
    "license": "owned",
    "alt_text": "Dumbbell bench press"
  }
]
```

Use service-role credentials, same pattern as `supabase/seed-exercises.ts`.

## API Contract Changes

### Catalog API

Update `apps/mobile/lib/api/exercises.ts`:

```ts
const exerciseImageSchema = z
  .object({
    url: z.string().url(),
    thumbnail_url: z.string().url().nullable().default(null),
    width: z.number().int().positive().nullable().default(null),
    height: z.number().int().positive().nullable().default(null),
    alt_text: z.string().nullable().default(null),
    blurhash: z.string().nullable().default(null),
    source: z
      .enum(["curated", "imported", "generated", "placeholder"])
      .nullable()
      .default(null),
  })
  .nullable();
```

Then extend `exerciseSchema`:

```ts
image: exerciseImageSchema.default(null),
image_url: z.string().nullable(),
video_url: z.string().nullable(),
```

Keep `image_url` during transition because existing RPCs already expose it and seed scripts know about it.

### Generated workout response

Update generator shared schema in `supabase/functions/_shared/generator.ts` and mobile schema in `apps/mobile/lib/api/generate-workout.ts`.

Recommended exercise payload:

```ts
const generatedExerciseImageSchema = z
  .object({
    url: z.string().url(),
    thumbnail_url: z.string().url().nullable(),
    alt_text: z.string().nullable(),
    blurhash: z.string().nullable(),
    source: z
      .enum(["curated", "imported", "generated", "placeholder"])
      .nullable(),
  })
  .nullable()
  .optional();
```

Add to `generatedExerciseSchema`:

```ts
image: generatedExerciseImageSchema,
```

Important: the LLM should not produce this field. The backend should enrich it after validation, using the selected `exercise_id`.

### Server-side generator enrichment

Update `ExerciseCatalogEntry` in `supabase/functions/_shared/generator.ts`:

```ts
export interface ExerciseCatalogEntry {
  id: string;
  name: string;
  exercise_type: "weight" | "time";
  primary_muscles: string[];
  secondary_muscles: string[] | null;
  equipment: string[];
  difficulty_level: string | null;
  image?: ExerciseImage | null;
}
```

Update `fetchExerciseCatalog()` to fetch media. Do not put image data in the LLM prompt. Either:

- select `image_url` and map it to a compact object for phase one, or
- call an RPC that returns catalog entries with media

Better phase-one query:

```ts
.from("exercises")
.select(`
  id,
  name,
  exercise_type,
  primary_muscles,
  secondary_muscles,
  equipment,
  difficulty_level,
  image_url,
  media:exercise_media_assets(
    kind,
    purpose,
    status,
    public_url,
    width,
    height,
    blurhash,
    alt_text,
    source,
    sort_order
  )
`)
```

Then select the best active image in TypeScript. Supabase nested filters can get awkward; an RPC is cleaner once the table exists.

During enrichment:

```ts
const enrichedExercises = workoutData.exercises.map((ex) => {
  const catalogEntry = catalogMap.get(ex.exercise_id);
  return {
    exercise_id: ex.exercise_id,
    exercise_name: catalogEntry?.name ?? "Unknown Exercise",
    exercise_type: catalogEntry?.exercise_type ?? "weight",
    image: catalogEntry?.image ?? null,
    sets: ex.sets,
    rest_duration_seconds: ex.rest_duration_seconds,
    notes: ex.notes,
    progression_type: null,
    previous_display: null,
  };
});
```

### Pending workout contract

`apps/mobile/lib/api/pending-workouts.ts` uses `generateWorkoutResponseSchema` for `workout_data`, so adding `image` there automatically supports queue responses once the schema changes.

Need to preserve media through:

- `LocalExercise` type in `apps/mobile/app/workout-preview.tsx`
- `user_edits.exercises`
- `useStartPendingWorkout()` input type in `apps/mobile/hooks/use-workout-queue.ts`
- local swap handling

When swapping an exercise in preview, the picker returns a full `Exercise`; update the swap state so the local pending exercise gets the new exercise image:

```ts
{
  exercise_id: swapResult.id,
  exercise_name: swapResult.name,
  exercise_type: swapResult.exercise_type,
  image: swapResult.image,
}
```

If the current swap result store only saves id/name, expand it to include `exercise_type` and `image`.

### Completed workout/session APIs

`get_workout_session_detail` currently returns exercise names/types/muscles and set data. For workout detail/history screens, add image metadata only where it will be rendered.

Recommended:

- Do not add images to history list RPC initially; it increases payload size for list screens.
- Add `image` to `get_workout_session_detail` only if `workout-detail.tsx` or summary views render thumbnails.
- Exercise detail should use `useExercise()` rather than stats RPC for media, which is already how it works today.

## Mobile UX and Implementation Changes

### Shared component: `ExerciseImage`

Create a reusable component:

`apps/mobile/components/exercise/exercise-image.tsx`

Responsibilities:

- use `expo-image` because it is already installed
- render a stable aspect-ratio box
- support `size="thumbnail" | "card" | "hero"`
- accept `image` object and `exerciseName`
- show an icon or quiet gradient placeholder when no image exists
- expose accessibility label from localized text
- avoid changing layout when image loading fails

Example interface:

```ts
interface ExerciseImageProps {
  image: ExerciseImageData | null | undefined;
  exerciseName: string;
  size: "thumbnail" | "card" | "hero";
}
```

Use `Image` from `expo-image`:

```tsx
<Image
  source={{ uri }}
  style={styles.image}
  contentFit="cover"
  transition={120}
  cachePolicy="disk"
  accessibilityLabel={altText}
/>
```

Fallback placeholder should use existing theme tokens and `IconSymbol`, not a new visual system.

### Active workout cards

Update `WorkoutExercise` in `apps/mobile/stores/workout-store.ts`:

```ts
image?: ExerciseImageData | null;
```

Update all mappings:

- `useGenerateWorkout()` direct generation mapper
- `useStartPendingWorkout()` pending queue mapper
- `mapDbToWorkoutStore()` if session resume/detail start uses it
- `replaceExercise()` and `addExercise()` should accept optional image

In `apps/mobile/app/workout.tsx`, the screen already fetches localized exercise rows for names. Pass image to the card using this priority:

1. `exercise.image` stored in active workout state
2. `exerciseMap.get(exercise.id)?.image`
3. legacy `exerciseMap.get(exercise.id)?.image_url`
4. null placeholder

Update `apps/mobile/components/workout/exercise-card.tsx`:

- replace `imagePlaceholder` with `ExerciseImage`
- keep the 44x44 footprint initially to protect in-session density
- make the image press target route to exercise detail along with the title
- do not add explanatory text inside the card

### Workout preview

Update local `ExerciseCard` in `apps/mobile/app/workout-preview.tsx`:

- add thumbnail at the left of the exercise header
- keep the row compact
- pass image through edit and start flows
- when swapping, show the swapped exercise image immediately

Because preview is a trust-building surface, a small thumbnail beside the generated exercise name helps users quickly identify what the plan means.

### Exercise picker

Update `apps/mobile/components/exercise-picker/exercise-row.tsx`:

- render a 40x40 thumbnail before the info block
- keep name and primary muscle text unchanged
- use placeholder when missing
- avoid changing row height drastically; current `minHeight` is 57, so 40x40 fits

Add tests that a row still calls `onSelect` and renders fallback when image is absent.

### Exercise detail

Update `apps/mobile/app/exercise-detail.tsx`:

- add a hero image above or inside the how-to tab content
- for `overview`, keep stats first unless a compact header image improves recognition without crowding
- for `howTo`, place the hero image before instructions
- if no instructions and no image, keep existing empty/todo copy
- if image exists but instructions are missing, the image still provides value

Recommended first implementation:

- render hero image only on `howTo`
- later consider a smaller image in the overview intro header after measuring layout

### Workout summary and detail

Optional phase-two:

- `workout-summary.tsx`: thumbnails beside each exercise in the completion summary
- `workout-detail.tsx`: thumbnails in completed workout detail
- `history` list: avoid initially, unless thumbnails are needed for recognition

Summary screens are less critical than active execution and how-to guidance.

### Localization strings

Add keys such as:

`apps/mobile/i18n/locales/en/exercise-detail.ts`

```ts
media: {
  imageAccessibilityLabel: "{{exerciseName}} illustration",
}
```

`apps/mobile/i18n/locales/en/workout.ts`

```ts
exercise: {
  imageAccessibilityLabel: "{{exerciseName}} illustration",
}
```

Mirror in Polish locale files.

If images are decorative thumbnails and the exercise name is already adjacent, consider `accessibilityIgnoresInvertColors` and avoid duplicate screen reader verbosity. For the full how-to image, use a meaningful label.

## AI Generation / Data Validation Changes

### Do not ask the LLM for images

The generator prompt should not include media URLs or ask the model to choose/generate images. The LLM should continue selecting exercise IDs from the catalog. Media should be deterministic catalog enrichment after validation.

Reasons:

- prevents hallucinated image URLs
- keeps licensing and review out of model output
- avoids exposing unnecessary URL noise in prompts
- keeps payload stable for fallbacks and substitutions

### Extend validation schemas

Update both backend and mobile Zod schemas with an optional nullable image object.

Backend:

- `generatedExerciseSchema` in `supabase/functions/_shared/generator.ts`

Mobile:

- `generateWorkoutResponseSchema` in `apps/mobile/lib/api/generate-workout.ts`
- older `apps/mobile/lib/api/ai-workout.ts` if it is still used or retained
- `exerciseSchema` in `apps/mobile/lib/api/exercises.ts`

Validation should require valid URLs only when present:

```ts
url: z.string().url();
```

If Supabase public URLs can contain characters that Zod accepts but React Native fails on, normalize/encode paths in the seed script rather than weakening validation.

### Catalog validation

Add media validation in the seed script and/or a backend helper:

- active image must have public URL or storage path
- active image must have positive dimensions if known
- content type must be allowed
- source/license should be non-null for non-placeholder assets
- only one active thumbnail and hero per exercise

### Fallback behavior

Fallback workout generation already selects from the same catalog. Once catalog entries carry media, fallback workouts get images automatically through enrichment.

If an invalid LLM exercise ID is substituted, the substitute should receive the replacement exercise media. That happens naturally if enrichment occurs after substitution.

### Exercise preferences

The generator imports `ExercisePreference` in several functions, but the shared generator interface in the current inspected code does not visibly define or use the preference data in `GenerateWorkoutParams`. While not part of image implementation, touch this area carefully: image work should not further widen generation prompt behavior. If adjusting generator types, keep media enrichment separate from preference logic.

## Testing Strategy

### Database tests / verification

Use Supabase local migrations and targeted SQL checks:

- migration applies cleanly
- `exercise_media_assets` RLS allows authenticated reads only for active assets
- service role can insert/update/archive assets
- unique active thumbnail and hero constraints work
- `get_localized_exercises()` returns `image: null` for missing media
- `get_localized_exercises()` returns correct primary image object for active media
- language fallback still works
- search/filter behavior is unchanged

### Edge function tests

Add or extend tests around `supabase/functions/_shared/generator.ts`:

- `fetchExerciseCatalog()` maps media into catalog entries
- `generateSingleWorkout()` enriches returned exercises with media after LLM success
- fallback generation also enriches media
- invalid ID substitution uses replacement media
- response schema accepts media and rejects invalid URLs
- no media URL appears in prompt text

### Mobile API tests

Extend:

- `apps/mobile/lib/api/__tests__/workout-mappers.test.ts`
- `apps/mobile/lib/api/__tests__/exercises.test.ts` if present or add it
- pending workout schema tests if added

Coverage:

- exercise schema parses `image`
- exercise schema parses legacy `image_url`
- generated workout schema parses image object
- mapper preserves image into `WorkoutExercise`
- mapper tolerates missing image
- replace/add exercise preserve optional image

### Mobile component tests

Add tests for:

- `ExerciseImage` renders placeholder without image
- `ExerciseImage` renders `expo-image` with image URL
- `ExerciseCard` displays image placeholder/image and keeps exercise title press behavior
- `ExerciseRow` calls `onSelect` with image-bearing exercise
- `exercise-detail` how-to tab renders image when present
- `workout-preview` preserves image through local edit/swap/start flow

Mock `expo-image` in Jest if the existing setup does not already handle it.

### Manual QA

Run:

```bash
npm run check-types
npm run lint
cd apps/mobile && npm test
```

Manual app flows:

- direct generated workout with mixed image/no-image exercises
- queued workout preview
- swap exercise in pending preview
- start pending workout
- active workout after app restart, verifying persisted store media survives
- exercise picker search/filter
- exercise detail how-to tab
- offline or poor network image failure placeholder
- Polish locale smoke test

### Performance checks

Validate:

- catalog list fetch payload size before/after media
- exercise picker scroll performance
- active workout screen first render
- image cache behavior after app restart
- memory behavior on low-end Android

If payload becomes large, return only thumbnail URLs in list RPCs and full hero data in `get_localized_exercise()`.

## Phased Implementation Roadmap

### Phase 0: Product and asset decisions

Resolve minimum decisions:

- image style: photo, clean illustration, line art, or rendered exercise diagram
- licensing/source: owned/generated/imported
- whether images are public
- MVP coverage target: top N exercises or all catalog exercises
- whether video is in scope now or later

Recommended assumption: curated/generated static WebP illustrations, public bucket, top 50-100 most-used exercises first, no video in phase one.

### Phase 1: Storage and database foundation

Deliverables:

- create `exercise-media` bucket config/migration
- create `exercise_media_assets` table and policies
- update `.ai/db-schema.md`
- add seed/import media manifest format
- upload a small pilot set of images
- update localized exercise RPCs to include `image`

Acceptance:

- `fetchExercises()` can parse media for pilot exercises
- missing media remains safe
- no app UI changes required yet

### Phase 2: Mobile catalog and display components

Deliverables:

- add `ExerciseImage` component
- update exercise schema
- render thumbnails in exercise picker
- render hero image in exercise detail how-to
- add i18n strings
- add component/schema tests

Acceptance:

- user can see images when browsing exercises and opening exercise detail
- no workout generation changes yet

### Phase 3: Generated workout contract and active-session UX

Deliverables:

- update backend generated workout schema
- enrich generated exercises with image object
- update mobile generated workout schema
- extend `WorkoutExercise` store model with image
- preserve image through direct generation, pending preview, pending start, and active workout
- replace active card placeholder with actual thumbnail

Acceptance:

- generated and queued workouts show thumbnails in preview and active workout
- swapped exercises update thumbnails
- active workout survives app restart with image metadata

### Phase 4: Backfill and rollout

Deliverables:

- import top exercise media set
- add asset coverage report script
- optionally backfill `exercises.image_url`
- add analytics event properties for image coverage if useful
- QA main flows

Acceptance:

- most generated workouts have media coverage
- no-image placeholders remain rare and polished

### Phase 5: Rich media expansion

Later options:

- multiple step images in how-to tab
- short video or animation support
- localized alt text
- admin/review tooling for generated images
- image-generation pipeline for missing exercises
- CDN/cache headers tuning

## Risks, Tradeoffs, and Open Questions

### Risks

- Licensing risk if importing exercise photos from third-party sources without clear rights.
- Misinstruction risk if an image shows poor form or does not match the exercise variation.
- Performance risk in picker and active workout if image payloads are large or not cached.
- Storage drift risk if database rows point to deleted objects.
- Product trust risk if generated workouts show generic or mismatched images.
- Schema drift risk because workout payloads are duplicated in `pending_workouts.workout_data`.
- Offline UX risk if active workout relies only on live catalog fetches for media.

### Tradeoffs

- Public bucket is simpler and faster, but assets are globally retrievable. This is acceptable for non-private exercise catalog images.
- Normalized media table is more work than URL columns, but avoids rework when adding hero images, videos, sources, and review status.
- Snapshotting image data into generated workouts improves queue/active resilience, but can show old images after asset updates.
- Joining media into all catalog list responses is easy, but can bloat payloads. If needed, split list thumbnail data from detail hero data.
- Static illustrations are safer and more consistent than photos, but less realistic for experienced users inspecting exact setup.

### Open product decisions

- What visual style should the app use: real photos, clean illustrations, anatomical diagrams, or generated studio-style images?
- Should images show start/end positions, one key pose, or multiple steps?
- Is video planned soon enough that the first data model must include video-ready fields now?
- What is the acceptable first-release coverage threshold?
- Should images be localized through alt text or mostly treated as language-neutral exercise illustrations?
- Should user-created/custom exercises ever be allowed to have user-uploaded media?
- Should images appear in the active card by default, or only after tapping into exercise detail for maximum in-session density?

### Reasonable assumptions to proceed

- Static images are phase-one scope; video is future scope.
- Exercise media is catalog-owned and non-private.
- Public Supabase Storage URLs are acceptable.
- The backend, not the LLM, owns media enrichment.
- Missing media must never block generation, preview, active workout, logging, or history.
- Active workout should store a compact media snapshot to avoid depending on live catalog fetches after the workout starts.

## Concrete File Change Checklist

### Supabase

- Add `supabase/migrations/*_add_exercise_media.sql`
- Update `supabase/migrations/*_add_exercise_translations.sql` behavior in a new migration by replacing `get_localized_exercises()` and `get_localized_exercise()`
- Add `supabase/seed-exercise-media.ts`
- Add `supabase/data/exercise-media-manifest.json`
- Update `supabase/functions/_shared/generator.ts`
- Update `supabase/functions/generate-workout/index.ts` only if request/response handling needs explicit typing changes
- Update `supabase/functions/generate-workout-queue/index.ts` only if queue context type needs media-safe mapping
- Update `supabase/functions/generate-next-workout/index.ts` similarly

### Mobile API and state

- Update `apps/mobile/lib/api/exercises.ts`
- Update `apps/mobile/lib/api/generate-workout.ts`
- Update `apps/mobile/lib/api/ai-workout.ts` or remove/deprecate it if unused
- Update `apps/mobile/lib/api/pending-workouts.ts` via schema propagation
- Update `apps/mobile/stores/workout-store.ts`
- Update `apps/mobile/hooks/use-generate-workout.ts`
- Update `apps/mobile/hooks/use-workout-queue.ts`
- Update `apps/mobile/lib/api/workout-mappers.ts`

### Mobile UI

- Add `apps/mobile/components/exercise/exercise-image.tsx`
- Update `apps/mobile/components/workout/exercise-card.tsx`
- Update `apps/mobile/components/exercise-picker/exercise-row.tsx`
- Update `apps/mobile/app/workout-preview.tsx`
- Update `apps/mobile/app/exercise-detail.tsx`
- Optionally update `apps/mobile/app/workout-detail.tsx` and `apps/mobile/app/workout-summary.tsx`

### i18n

- Update `apps/mobile/i18n/locales/en/workout.ts`
- Update `apps/mobile/i18n/locales/pl/workout.ts`
- Update `apps/mobile/i18n/locales/en/exercise-detail.ts`
- Update `apps/mobile/i18n/locales/pl/exercise-detail.ts`
- Update picker namespace files if thumbnails need accessibility labels there

### Tests

- Add DB/RPC smoke tests or SQL verification notes
- Add generator schema/enrichment tests
- Add mobile schema/mapper tests
- Add `ExerciseImage` component tests
- Extend existing workout card/picker/detail tests

## Recommended MVP Slice

The smallest implementation that creates real user value:

1. Create public `exercise-media` bucket and normalized `exercise_media_assets` table.
2. Seed 20-50 high-frequency exercise thumbnails and hero images.
3. Return `image` from localized exercise RPCs.
4. Add `ExerciseImage` component.
5. Show thumbnails in exercise picker and active workout cards.
6. Show hero image in exercise detail how-to.
7. Enrich generated workout payloads with image snapshots so pending preview and active workouts do not depend on a second catalog query.

This strengthens the core training loop without adding planning overhead or turning media into an AI feature for its own sake.
