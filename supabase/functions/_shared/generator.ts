import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import {
  calculateProgression,
  type ExerciseHistory,
  formatExerciseDuration,
} from "./progression.ts";
import {
  getSafeStartingLoadKg,
  repairWorkoutPrescriptions,
} from "./prescription-validation.ts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
export const OPENROUTER_MODEL = "z-ai/glm-4.7-flash";
export const LLM_TIMEOUT_MS = 15_000;

export const EXERCISE_COUNTS: Record<number, { min: number; max: number }> = {
  15: { min: 3, max: 4 },
  30: { min: 4, max: 6 },
  45: { min: 5, max: 7 },
  60: { min: 6, max: 9 },
  90: { min: 8, max: 12 },
};

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

export const llmSetSchema = z.object({
  set_type: z.enum(["warmup", "working"]),
  target_load_kg: z.number().min(0).optional(),
  target_reps: z.number().int().min(1).optional(),
  target_duration_seconds: z.number().int().min(1).optional(),
});

export const workoutReasoningSchema = z.object({
  muscle_groups: z.string().min(1).max(360),
  training_strategy: z.string().min(1).max(360),
});

export const exerciseReasoningSchema = z.object({
  muscle_groups: z.string().min(1).max(280),
  exercise_selection: z.string().min(1).max(320),
});

export const llmExerciseSchema = z.object({
  exercise_id: z.string().uuid(),
  sets: z.array(llmSetSchema).min(1),
  rest_duration_seconds: z.number().int().min(15).max(300),
  notes: z.string().nullable(),
  reasoning: exerciseReasoningSchema.nullable().optional(),
});

export const llmResponseSchema = z.object({
  workout_name: z.string().min(1).max(100),
  reasoning: workoutReasoningSchema.nullable().optional(),
  warmup: z.object({ duration_seconds: z.number().int().min(60).max(900) }),
  exercises: z.array(llmExerciseSchema).min(1),
});

export const generatedWarmupSchema = z.object({
  duration_seconds: z.number().int().min(60).max(900),
});

export const generatedSetSchema = z.object({
  set_type: z.enum(["warmup", "working"]),
  target_load_kg: z.number().min(0).optional(),
  target_reps: z.number().int().min(1).optional(),
  target_duration_seconds: z.number().int().min(1).optional(),
});

export const exerciseImageSchema = z
  .object({
    url: z.string().url(),
    thumbnail_url: z.string().url().nullable().default(null),
    width: z.number().int().positive().nullable().default(null),
    height: z.number().int().positive().nullable().default(null),
    thumbnail_width: z.number().int().positive().nullable().default(null),
    thumbnail_height: z.number().int().positive().nullable().default(null),
    alt_text: z.string().nullable().default(null),
    blurhash: z.string().nullable().default(null),
    source: z
      .enum(["curated", "imported", "generated", "placeholder"])
      .nullable()
      .default(null),
  })
  .nullable();

export const progressionTypeSchema = z.enum([
  "weight_up",
  "reps_up",
  "maintained",
  "new_exercise",
]);

export const generatedExerciseSchema = z.object({
  exercise_id: z.string().uuid(),
  exercise_name: z.string(),
  exercise_type: z.enum(["weight", "time"]).default("weight"),
  image: exerciseImageSchema.default(null).optional(),
  sets: z.array(generatedSetSchema).min(1),
  rest_duration_seconds: z.number().int().min(15).max(300),
  notes: z.string().nullable(),
  reasoning: exerciseReasoningSchema.nullable().optional().default(null),
  progression_type: progressionTypeSchema.nullable().optional(),
  previous_display: z.string().nullable().optional(),
});

export const generateWorkoutResponseSchema = z.object({
  workout_name: z.string(),
  reasoning: workoutReasoningSchema.nullable().optional().default(null),
  warmup: generatedWarmupSchema.nullable().default(null),
  generation_source: z.enum([
    "llm",
    "fallback_template",
    "fallback_substitution",
  ]),
  goal_snapshot: z.enum([
    "build_strength",
    "lose_weight",
    "improve_fitness",
    "custom",
  ]),
  custom_goal_snapshot: z.string().nullable(),
  exercises: z.array(generatedExerciseSchema),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExerciseCatalogEntry {
  id: string;
  name: string;
  exercise_type: "weight" | "time";
  primary_muscles: string[];
  secondary_muscles: string[] | null;
  equipment: string[];
  difficulty_level: string | null;
  image_url?: string | null;
  image?: z.infer<typeof exerciseImageSchema>;
}

export interface ProfileData {
  goal: string;
  custom_goal: string | null;
  weekly_frequency: string;
  gender: string | null;
}

export interface HistorySession {
  name: string | null;
  completed_at: string | null;
  exercises: {
    exercise_name: string;
    exercise_type?: "weight" | "time";
    difficulty_feedback: string | null;
    sets: {
      set_type: string;
      target_load_kg?: number;
      target_reps?: number;
      target_duration_seconds?: number;
      log: {
        actual_load_kg: number | null;
        actual_reps: number | null;
        actual_duration_seconds?: number | null;
        rpe: number | null;
        completed: boolean;
      } | null;
    }[];
  }[];
}

export interface StrengthBaseline {
  exercise_key: string;
  load_kg: number | null;
  reps: number;
}

export interface ExercisePreference {
  exercise_id: string;
  preference: "preferred" | "soft_dislike" | "hard_dislike";
}

export interface QueueContextItem {
  queue_position: number;
  focus_area: string | null;
  workout_data: {
    workout_name: string;
    exercises: {
      exercise_name: string;
      sets: {
        target_load_kg?: number;
        target_reps?: number;
        target_duration_seconds?: number;
      }[];
    }[];
  } | null;
}

export interface RecentSessionComment {
  comment: string;
  created_at: string;
}

export interface GenerateWorkoutParams {
  supabaseClient: SupabaseClient;
  userId: string;
  profile: ProfileData;
  trainingSplit: string;
  durationMinutes: number;
  equipment: string;
  trainingStyle: string;
  difficulty: string;
  customPrompt?: string;
  focusArea?: string;
  strengthBaselines?: StrengthBaseline[];
  exercisePreferences?: ExercisePreference[];
  queueContext?: QueueContextItem[];
  history?: HistorySession[];
  recentComments?: RecentSessionComment[];
  regenerationFeedback?: string;
}

// ---------------------------------------------------------------------------
// Helper: History Summary
// ---------------------------------------------------------------------------

export function summarizeHistory(sessions: HistorySession[]): string {
  if (sessions.length === 0) return "No previous workout history available.";

  return sessions
    .map((s, i) => {
      const date = s.completed_at
        ? new Date(s.completed_at).toLocaleDateString()
        : "unknown date";
      const name = s.name ?? "Unnamed workout";
      const exercises = s.exercises
        .map((ex) => {
          const feedback = ex.difficulty_feedback
            ? ` (feedback: ${ex.difficulty_feedback})`
            : "";
          const isTime = ex.exercise_type === "time";
          const setsSummary = ex.sets
            .filter((set) => set.log?.completed)
            .map((set) => {
              if (isTime) {
                const dur =
                  set.log?.actual_duration_seconds ??
                  set.target_duration_seconds;
                return dur ? formatExerciseDuration(dur) : "?s";
              }
              return `${set.log?.actual_load_kg ?? set.target_load_kg ?? 0}kg×${set.log?.actual_reps ?? set.target_reps ?? 0}`;
            })
            .join(", ");
          return `  - ${ex.exercise_name}: ${setsSummary || "no completed sets"}${feedback}`;
        })
        .join("\n");
      return `Session ${i + 1} (${date}) — ${name}:\n${exercises}`;
    })
    .join("\n\n");
}

// ---------------------------------------------------------------------------
// Helper: Format Strength Baselines for Prompt
// ---------------------------------------------------------------------------

function formatBaselines(baselines: StrengthBaseline[]): string {
  if (baselines.length === 0) return "";

  const labels: Record<string, string> = {
    pushups: "Push-ups",
    pullups: "Pull-ups/Chin-ups",
    db_bench: "Dumbbell Bench Press",
    db_row: "Dumbbell Row",
    bb_bench: "Barbell Bench Press",
    bb_squat: "Barbell Squat",
    deadlift: "Deadlift",
  };

  const lines = baselines.map((b) => {
    const label = labels[b.exercise_key] ?? b.exercise_key;
    const load = b.load_kg ? `${b.load_kg}kg × ` : "";
    return `- ${label}: ${load}${b.reps} reps`;
  });

  return [
    "## User's Current Strength Levels",
    lines.join("\n"),
    "Use these as reference points when programming loads. For exercises the user hasn't tested, estimate conservatively based on these numbers and their experience level.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Helper: Format Queue Context for Prompt
// ---------------------------------------------------------------------------

function formatQueueContext(context: QueueContextItem[]): string {
  if (context.length === 0) return "";

  const lines = context.map((item) => {
    const focus = item.focus_area ?? "unknown";
    const name = item.workout_data?.workout_name ?? "TBD";
    const exercises =
      item.workout_data?.exercises
        ?.map((ex) => {
          const setsSummary = ex.sets
            .map((s) => {
              if (s.target_duration_seconds != null) {
                return formatExerciseDuration(s.target_duration_seconds);
              }
              return `${s.target_load_kg ?? 0}kg×${s.target_reps ?? 0}`;
            })
            .join(", ");
          return `${ex.exercise_name} (${setsSummary})`;
        })
        .join(", ") ?? "not yet generated";
    return `- Day ${item.queue_position} (${focus}): ${name} — ${exercises}`;
  });

  return [
    "## Other Workouts in This Week's Plan",
    lines.join("\n"),
    "Ensure variety by selecting different exercises and varying the stimulus for this workout's focus.",
  ].join("\n");
}

function formatFocusLabel(value: string | undefined): string {
  return (value ?? "full_body")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatMuscleList(muscles: string[] | null | undefined): string {
  if (!muscles?.length) return "the planned target muscles";
  return muscles.map((muscle) => muscle.replace(/_/g, " ")).join(", ");
}

function clampReasoningText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trim()}...`;
}

function buildDefaultWorkoutReasoning(params: {
  trainingSplit: string;
  trainingStyle: string;
  difficulty: string;
  focusArea?: string;
  hasHistory: boolean;
}): z.infer<typeof workoutReasoningSchema> {
  const focusLabel = formatFocusLabel(params.focusArea ?? params.trainingSplit);
  const splitLabel = params.trainingSplit.replace(/_/g, " ");

  return {
    muscle_groups: clampReasoningText(
      `This session focuses on ${focusLabel} because it fits the ${splitLabel} split and keeps the weekly plan balanced.`,
      360
    ),
    training_strategy: clampReasoningText(
      `The plan uses ${params.trainingStyle} targets at a ${params.difficulty} level${params.hasHistory ? " while accounting for recent workout history and progression." : " with conservative starting targets because there is limited recent history."}`,
      360
    ),
  };
}

function buildDefaultExerciseReasoning(params: {
  exercise: ExerciseCatalogEntry;
  trainingStyle: string;
  focusArea?: string;
  progressionType?: string | null;
  previousDisplay?: string | null;
}): z.infer<typeof exerciseReasoningSchema> {
  const primary = formatMuscleList(params.exercise.primary_muscles);
  const secondary = formatMuscleList(params.exercise.secondary_muscles);
  const hasSecondary = !!params.exercise.secondary_muscles?.length;
  const focusLabel = formatFocusLabel(params.focusArea);
  const equipment = params.exercise.equipment.length
    ? params.exercise.equipment.join(", ")
    : "bodyweight";
  const progressionNote =
    params.progressionType && params.progressionType !== "new_exercise"
      ? ` The target also reflects the user's previous best of ${params.previousDisplay ?? "recent completed sets"}.`
      : "";

  return {
    muscle_groups: clampReasoningText(
      `${params.exercise.name} targets ${primary}${hasSecondary ? ` with support from ${secondary}` : ""}, which matches the ${focusLabel} emphasis.`,
      280
    ),
    exercise_selection: clampReasoningText(
      `It fits the available ${equipment} setup and gives a useful ${params.trainingStyle} stimulus without adding unnecessary complexity.${progressionNote}`,
      320
    ),
  };
}

// ---------------------------------------------------------------------------
// Prompt Builder
// ---------------------------------------------------------------------------

function formatRecentComments(comments: RecentSessionComment[]): string {
  if (comments.length === 0) return "";
  const labels = ["Most recent", "2 sessions ago", "3 sessions ago"];
  const lines = comments
    .slice(0, 3)
    .map(
      (c, i) =>
        `- ${labels[i] ?? `${i + 1} sessions ago`}: "${c.comment.replace(/"/g, "'")}"`
    );
  return [
    "## Recent User Feedback (session notes)",
    "The user left these notes after recent workouts. Weight the most recent more heavily, but avoid over-correcting if a concern was already addressed.",
    lines.join("\n"),
  ].join("\n");
}

function formatRegenerationFeedback(feedback: string | undefined): string {
  const trimmed = feedback?.trim();
  if (!trimmed) return "";

  return [
    "## Regeneration Feedback",
    "The user is replacing the current pending workout and specifically asked for this change. Prioritize it when it does not conflict with safety, available equipment, or the exercise catalog.",
    trimmed.replace(/"/g, "'"),
  ].join("\n");
}

export function buildPrompt(
  profile: ProfileData,
  trainingSplit: string,
  durationMinutes: number,
  equipment: string,
  trainingStyle: string,
  difficulty: string,
  customPrompt: string | undefined,
  catalog: ExerciseCatalogEntry[],
  history: HistorySession[],
  focusArea?: string,
  strengthBaselines?: StrengthBaseline[],
  queueContext?: QueueContextItem[],
  recentComments?: RecentSessionComment[],
  regenerationFeedback?: string
): { system: string; user: string } {
  const counts = EXERCISE_COUNTS[durationMinutes] ?? { min: 5, max: 7 };

  const exerciseList = catalog
    .map(
      (e) =>
        `- ID: ${e.id} | Name: ${e.name} | Type: ${e.exercise_type} | Muscles: ${e.primary_muscles.join(", ")} | Equipment: ${e.equipment.join(", ") || "bodyweight"} | Difficulty: ${e.difficulty_level ?? "unknown"}`
    )
    .join("\n");

  const system = `You are a certified personal trainer creating a workout plan.
You MUST respond with valid JSON matching the exact schema below. No extra text, no markdown.
Select exercises ONLY from the provided exercise catalog using their exact IDs.
Design for progressive overload based on the user's history.

Response JSON schema:
{
  "workout_name": "string — creative, motivating workout name",
  "reasoning": {
    "muscle_groups": "string — 1-2 short sentences explaining why this muscle focus fits the split, goal, history, queue context, or custom request",
    "training_strategy": "string — 1-2 short sentences explaining the session structure, intensity, and progression approach"
  "warmup": {
    "duration_seconds": "number — timer-only general warmup duration in seconds"
  },
  "exercises": [
    {
      "exercise_id": "string — UUID from the catalog",
      "sets": [
        {
          "set_type": "warmup | working",
          // For weight exercises (Type: weight):
          "target_load_kg": "number — weight in kg",
          "target_reps": "number — target repetitions",
          // For time exercises (Type: time), use instead:
          "target_duration_seconds": "number — hold duration in seconds"
        }
      ],
      "rest_duration_seconds": "number — rest between sets (30-180)",
      "notes": "string | null — brief coaching tip if technique matters",
      "reasoning": {
        "muscle_groups": "string — concise reason this exercise targets the intended muscles",
        "exercise_selection": "string — concise reason this specific exercise was selected over alternatives, referencing equipment, preferences, progression, or safety"
      }
    }
  ]
}

IMPORTANT: For exercises with Type: time, use target_duration_seconds (not target_load_kg/target_reps).
For exercises with Type: weight, use target_load_kg and target_reps (not target_duration_seconds).
For loaded weight exercises, target_load_kg MUST be greater than zero. Zero is only valid when the catalog equipment identifies a bodyweight or loadless movement.
Use at least 5 reps for warmups and working sets. Three-rep working sets are only valid for intermediate or advanced strength training.
Keep every reasoning field specific, plain-language, and under 35 words. Do not reveal hidden chain-of-thought; provide short user-facing rationale only.`;

  const splitLabel = trainingSplit.replace(/_/g, " ");
  const customSection = customPrompt
    ? `\n\n## Custom Instructions\n${customPrompt}`
    : "";
  const focusSection = focusArea
    ? `\n- Today's focus: ${focusArea.replace(/_/g, " ")} — select exercises targeting this muscle group/focus`
    : "";
  const baselinesSection = strengthBaselines?.length
    ? `\n\n${formatBaselines(strengthBaselines)}`
    : "";
  const queueContextSection = queueContext?.length
    ? `\n\n${formatQueueContext(queueContext)}`
    : "";
  const recentCommentsSection = recentComments?.length
    ? `\n\n${formatRecentComments(recentComments)}`
    : "";
  const regenerationFeedbackSection = regenerationFeedback
    ? `\n\n${formatRegenerationFeedback(regenerationFeedback)}`
    : "";

  const user = `## User Profile
- Goal: ${profile.goal}${profile.custom_goal ? ` (${profile.custom_goal})` : ""}
- Weekly frequency: ${profile.weekly_frequency} days/week
- Gender: ${profile.gender ?? "not specified"}

## Workout Parameters
- Training split: ${splitLabel}
- Training style: ${trainingStyle}
- Difficulty level: ${difficulty}
- Available equipment: ${equipment.replace(/_/g, " ")}
- Target duration: ${durationMinutes} minutes
- Select ${counts.min}-${counts.max} exercises${focusSection}

## Constraints
- Use ONLY exercise IDs from the catalog below
- Include one timer-only general warmup before the exercises. Use 180 seconds for 15-minute workouts, 300 seconds for 30-60 minute workouts, and 420 seconds for 90-minute workouts.
- Match exercises to the "${equipment.replace(/_/g, " ")}" equipment level
- Tailor set/rep schemes to "${trainingStyle}" style (strength: heavy/low reps, hypertrophy: moderate/8-12 reps, endurance: light/high reps, circuit: varied/minimal rest)
- Adjust complexity and load for "${difficulty}" level
- For "${splitLabel}" split, choose an appropriate muscle group focus for today's session
- Include 1 warmup set per compound exercise (lower weight, higher reps)
- Progressive overload: if user completed previous load and feedback was "ok" or "too_easy", increase by 2.5-5kg (or +10-15s for time exercises)
- If feedback was "too_hard", maintain or slightly reduce load/duration
- For new exercises (no history), use moderate starting weights or durations (20-45s for time exercises)
- Generate a creative, motivating workout name
- Explain why the chosen muscle groups and each exercise fit today's plan using concise user-facing reasoning
- For time exercises (Type: time), use target_duration_seconds instead of target_load_kg/target_reps

## Recent Workout History
${summarizeHistory(history)}

## Exercise Catalog
${exerciseList}${baselinesSection}${queueContextSection}${recentCommentsSection}${regenerationFeedbackSection}${customSection}`;

  return { system, user };
}

// ---------------------------------------------------------------------------
// Fallback Workout Builder
// ---------------------------------------------------------------------------

export function buildFallbackWorkout(
  catalog: ExerciseCatalogEntry[],
  trainingSplit: string,
  durationMinutes: number,
  trainingStyle: string,
  difficulty = "intermediate",
  focusArea?: string,
  hasHistory = false
): z.infer<typeof llmResponseSchema> {
  const counts = EXERCISE_COUNTS[durationMinutes] ?? { min: 5, max: 7 };

  const styleSchemes: Record<
    string,
    { sets: number; reps: number; rest: number; duration: number }
  > = {
    strength: { sets: 4, reps: 5, rest: 120, duration: 30 },
    hypertrophy: { sets: 3, reps: 10, rest: 90, duration: 40 },
    endurance: { sets: 3, reps: 15, rest: 45, duration: 45 },
    circuit: { sets: 3, reps: 12, rest: 30, duration: 30 },
  };
  const scheme = styleSchemes[trainingStyle] ?? styleSchemes.hypertrophy;

  const shuffled = [...catalog].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, counts.max);
  const splitLabel = trainingSplit.replace(/_/g, " ");

  return {
    workout_name: `${splitLabel.charAt(0).toUpperCase() + splitLabel.slice(1)} Workout`,
    reasoning: buildDefaultWorkoutReasoning({
      trainingSplit,
      trainingStyle,
      difficulty,
      focusArea,
      hasHistory,
    }),
    warmup: {
      duration_seconds:
        durationMinutes <= 15 ? 180 : durationMinutes >= 90 ? 420 : 300,
    },
    exercises: selected.map((ex) => {
      if (ex.exercise_type === "time") {
        return {
          exercise_id: ex.id,
          sets: Array.from({ length: scheme.sets }, () => ({
            set_type: "working" as const,
            target_duration_seconds: scheme.duration,
          })),
          rest_duration_seconds: scheme.rest,
          notes: null,
          reasoning: buildDefaultExerciseReasoning({
            exercise: ex,
            trainingStyle,
            focusArea,
          }),
        };
      }

      const isCompound =
        ex.primary_muscles.length > 1 ||
        ["barbell", "dumbbell"].some((eq) =>
          ex.equipment.some((e) => e.toLowerCase().includes(eq))
        );

      const warmupSets: z.infer<typeof llmSetSchema>[] = isCompound
        ? [
            {
              set_type: "warmup" as const,
              target_load_kg: getSafeStartingLoadKg(ex.equipment),
              target_reps: 10,
            },
          ]
        : [];

      const startingLoadKg = getSafeStartingLoadKg(ex.equipment);
      const workingSets: z.infer<typeof llmSetSchema>[] = Array.from(
        { length: scheme.sets },
        () => ({
          set_type: "working" as const,
          target_load_kg: startingLoadKg,
          target_reps: scheme.reps,
        })
      );

      return {
        exercise_id: ex.id,
        sets: [...warmupSets, ...workingSets],
        rest_duration_seconds: scheme.rest,
        notes: null,
        reasoning: buildDefaultExerciseReasoning({
          exercise: ex,
          trainingStyle,
          focusArea,
        }),
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Exercise Catalog Fetcher
// ---------------------------------------------------------------------------

export async function fetchExerciseCatalog(
  supabaseClient: SupabaseClient,
  equipment: string
): Promise<ExerciseCatalogEntry[]> {
  const equipmentFilters: Record<string, string[] | null> = {
    bodyweight: ["bodyweight", "Body weight"],
    dumbbells: ["bodyweight", "Body weight", "Dumbbell", "Dumbbells"],
    barbell: ["bodyweight", "Body weight", "Dumbbell", "Dumbbells", "Barbell"],
    full_gym: null,
  };

  let exerciseQuery = supabaseClient
    .from("exercises")
    .select(
      "id, name, exercise_type, primary_muscles, secondary_muscles, equipment, difficulty_level, image_url"
    )
    .eq("catalog_status", "active");

  const filter = equipmentFilters[equipment];
  if (filter) {
    exerciseQuery = exerciseQuery.overlaps("equipment", filter);
  }

  const { data, error } = await exerciseQuery.order("name").limit(100);
  if (error || !data?.length) return [];

  const catalog = data as ExerciseCatalogEntry[];
  const exerciseIds = catalog.map((exercise) => exercise.id);
  const { data: mediaRows } = await supabaseClient
    .from("exercise_media_assets")
    .select(
      "exercise_id, purpose, source, public_url, width, height, blurhash, alt_text, sort_order, created_at"
    )
    .in("exercise_id", exerciseIds)
    .eq("kind", "image")
    .eq("status", "active");

  const mediaByExercise = new Map<string, typeof mediaRows>();
  for (const media of mediaRows ?? []) {
    const current = mediaByExercise.get(media.exercise_id) ?? [];
    current.push(media);
    mediaByExercise.set(media.exercise_id, current);
  }

  return catalog.map((exercise) => {
    const media = mediaByExercise.get(exercise.id) ?? [];
    const sorted = [...media].sort((a, b) => {
      const purposeRank = (purpose: string | null) =>
        purpose === "hero" ? 0 : purpose === "thumbnail" ? 1 : 2;
      const rankDiff = purposeRank(a.purpose) - purposeRank(b.purpose);
      if (rankDiff !== 0) return rankDiff;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
    const primary = sorted[0];
    const thumbnail = media.find((item) => item.purpose === "thumbnail");
    const fallbackUrl = exercise.image_url ?? null;

    return {
      ...exercise,
      image:
        primary?.public_url || fallbackUrl
          ? {
              url: primary?.public_url ?? fallbackUrl!,
              thumbnail_url: thumbnail?.public_url ?? null,
              width: primary?.width ?? null,
              height: primary?.height ?? null,
              thumbnail_width: thumbnail?.width ?? null,
              thumbnail_height: thumbnail?.height ?? null,
              alt_text: primary?.alt_text ?? null,
              blurhash: primary?.blurhash ?? null,
              source: primary?.source ?? null,
            }
          : null,
    };
  });
}

// ---------------------------------------------------------------------------
// Focus Area Determination
// ---------------------------------------------------------------------------

export function getFocusAreaForPosition(
  split: string,
  position: number
): string {
  switch (split) {
    case "full_body":
      return "full_body";
    case "upper_lower":
      return position % 2 === 1 ? "upper" : "lower";
    case "push_pull_legs": {
      const cycle = ["push", "pull", "legs"];
      return cycle[(position - 1) % 3];
    }
    default:
      return "full_body";
  }
}

export function determineReplacementFocusArea(
  split: string,
  currentQueue: { focus_area: string | null }[]
): string {
  if (split === "full_body") return "full_body";

  if (split === "upper_lower") {
    const upperCount = currentQueue.filter(
      (q) => q.focus_area === "upper"
    ).length;
    const lowerCount = currentQueue.filter(
      (q) => q.focus_area === "lower"
    ).length;
    return upperCount <= lowerCount ? "upper" : "lower";
  }

  if (split === "push_pull_legs") {
    const counts: Record<string, number> = { push: 0, pull: 0, legs: 0 };
    currentQueue.forEach((q) => {
      if (q.focus_area && counts[q.focus_area] !== undefined)
        counts[q.focus_area]++;
    });
    const minCount = Math.min(...Object.values(counts));
    const leastUsed = Object.entries(counts).find(
      ([, c]) => c === minCount
    )?.[0];
    return leastUsed ?? "push";
  }

  return "full_body";
}

// ---------------------------------------------------------------------------
// Core: Generate Single Workout
// ---------------------------------------------------------------------------

export async function generateSingleWorkout(
  params: GenerateWorkoutParams
): Promise<{
  success: boolean;
  data?: z.infer<typeof generateWorkoutResponseSchema>;
  generationSource?: "llm" | "fallback_template" | "fallback_substitution";
  error?: string;
}> {
  const {
    supabaseClient,
    userId,
    profile,
    trainingSplit,
    durationMinutes,
    equipment,
    trainingStyle,
    difficulty,
    customPrompt,
    focusArea,
    strengthBaselines,
    queueContext,
    history = [],
    recentComments,
    regenerationFeedback,
  } = params;

  // Fetch exercise catalog
  const catalog = await fetchExerciseCatalog(supabaseClient, equipment);
  if (!catalog.length) {
    return {
      success: false,
      error: "No exercises found for this equipment level",
    };
  }
  const catalogMap = new Map(catalog.map((e) => [e.id, e]));

  // Try LLM generation
  const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
  let generationSource: "llm" | "fallback_template" | "fallback_substitution" =
    "llm";
  let workoutData: z.infer<typeof llmResponseSchema>;

  if (openrouterKey) {
    try {
      const prompt = buildPrompt(
        profile,
        trainingSplit,
        durationMinutes,
        equipment,
        trainingStyle,
        difficulty,
        customPrompt,
        catalog,
        history,
        focusArea,
        strengthBaselines,
        queueContext,
        recentComments,
        regenerationFeedback
      );

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

      const llmResponse = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openrouterKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          messages: [
            { role: "system", content: prompt.system },
            { role: "user", content: prompt.user },
          ],
          response_format: { type: "json_object" },
          temperature: 0.7,
          max_tokens: 2800,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!llmResponse.ok) {
        const errorBody = await llmResponse.text();
        throw new Error(
          `OpenRouter returned ${llmResponse.status}: ${errorBody.slice(0, 200)}`
        );
      }

      const llmJson = await llmResponse.json();
      console.log("llmJson", llmJson);
      console.log("llmJson.choices", llmJson.choices);
      const msg = llmJson.choices?.[0]?.message;
      const content = msg?.content || msg?.reasoning;
      if (!content) throw new Error("Empty LLM response");

      const parsedContent = JSON.parse(content);
      workoutData = llmResponseSchema.parse(parsedContent);

      // Validate exercise IDs and substitute invalid ones
      let hasSubstitutions = false;
      for (let i = 0; i < workoutData.exercises.length; i++) {
        if (!catalogMap.has(workoutData.exercises[i].exercise_id)) {
          const replacement =
            catalog[Math.floor(Math.random() * catalog.length)];
          workoutData.exercises[i] = {
            ...workoutData.exercises[i],
            exercise_id: replacement.id,
            reasoning: null,
          };
          hasSubstitutions = true;
        }
      }
      if (hasSubstitutions) generationSource = "fallback_substitution";
    } catch (err) {
      console.error(
        "[generator] LLM generation failed:",
        err instanceof Error ? err.message : String(err)
      );
      workoutData = buildFallbackWorkout(
        catalog,
        trainingSplit,
        durationMinutes,
        trainingStyle,
        difficulty,
        focusArea,
        history.length > 0
      );
      generationSource = "fallback_template";
    }
  } else {
    workoutData = buildFallbackWorkout(
      catalog,
      trainingSplit,
      durationMinutes,
      trainingStyle,
      difficulty,
      focusArea,
      history.length > 0
    );
    generationSource = "fallback_template";
  }

  // Enrich with exercise names and types
  const enrichedExercises = workoutData.exercises.map((ex) => {
    const catalogEntry = catalogMap.get(ex.exercise_id);
    return {
      exercise_id: ex.exercise_id,
      exercise_name: catalogEntry?.name ?? "Unknown Exercise",
      exercise_type: (catalogEntry?.exercise_type ?? "weight") as
        "weight" | "time",
      image: catalogEntry?.image ?? null,
      sets: ex.sets,
      rest_duration_seconds: ex.rest_duration_seconds,
      notes: ex.notes,
      reasoning: ex.reasoning ?? null,
      progression_type: null as string | null,
      previous_display: null as string | null,
    };
  });

  // Apply progressive overload
  const exerciseIds = enrichedExercises.map((ex) => ex.exercise_id);
  try {
    const { data: progressionHistory } = await supabaseClient.rpc(
      "get_exercise_progression_history",
      { p_user_id: userId, p_exercise_ids: exerciseIds }
    );

    if (progressionHistory?.length) {
      const historyMap = new Map<string, ExerciseHistory>();
      for (const row of progressionHistory as ExerciseHistory[]) {
        historyMap.set(row.exercise_id, row);
      }

      for (const ex of enrichedExercises) {
        const hist = historyMap.get(ex.exercise_id);
        const catalogEntry = catalogMap.get(ex.exercise_id);
        const exEquipment = catalogEntry?.equipment ?? [];

        const result = calculateProgression(
          hist ?? null,
          exEquipment,
          trainingStyle
        );
        if (result) {
          ex.progression_type = result.progression_type;
          ex.previous_display = result.previous_display;

          // Override working set targets
          if (result.progression_type !== "new_exercise") {
            for (const set of ex.sets) {
              if (set.set_type === "working") {
                if (result.target_duration_seconds != null) {
                  set.target_duration_seconds = result.target_duration_seconds;
                  set.target_load_kg = undefined;
                  set.target_reps = undefined;
                } else {
                  set.target_load_kg = result.target_load_kg ?? 0;
                  set.target_reps = result.target_reps ?? 1;
                  set.target_duration_seconds = undefined;
                }
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.error(
      "[generator] Progression override failed (non-fatal):",
      err instanceof Error ? err.message : String(err)
    );
  }

  const prescriptionExercises = enrichedExercises.map((exercise) => ({
    exercise_id: exercise.exercise_id,
    exercise_type: exercise.exercise_type,
    equipment: catalogMap.get(exercise.exercise_id)?.equipment ?? [],
    sets: exercise.sets,
  }));
  const prescriptionIssues = repairWorkoutPrescriptions(prescriptionExercises, {
    trainingStyle,
    difficulty,
  });
  if (prescriptionIssues.length > 0) {
    console.warn("[generator] Repaired invalid workout prescriptions", {
      userId,
      generationSource,
      issueCount: prescriptionIssues.length,
      issues: prescriptionIssues,
    });
  }

  const profileGoal = profile.goal ?? "improve_fitness";
  const workoutReasoning =
    workoutData.reasoning ??
    buildDefaultWorkoutReasoning({
      trainingSplit,
      trainingStyle,
      difficulty,
      focusArea,
      hasHistory: history.length > 0,
    });

  const exercisesWithReasoning = enrichedExercises.map((ex) => {
    if (ex.reasoning) return ex;

    const catalogEntry = catalogMap.get(ex.exercise_id);
    if (!catalogEntry) return ex;

    return {
      ...ex,
      reasoning: buildDefaultExerciseReasoning({
        exercise: catalogEntry,
        trainingStyle,
        focusArea,
        progressionType: ex.progression_type,
        previousDisplay: ex.previous_display,
      }),
    };
  });

  const response = generateWorkoutResponseSchema.parse({
    workout_name: workoutData.workout_name,
    reasoning: workoutReasoning,
    warmup: workoutData.warmup,
    generation_source: generationSource,
    goal_snapshot: profileGoal,
    custom_goal_snapshot: profile.custom_goal ?? null,
    exercises: exercisesWithReasoning,
  });

  return { success: true, data: response, generationSource };
}
