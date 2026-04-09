import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { calculateProgression, type ExerciseHistory } from "./progression.ts";

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
  target_load_kg: z.number().min(0),
  target_reps: z.number().int().min(1),
});

export const llmExerciseSchema = z.object({
  exercise_id: z.string().uuid(),
  sets: z.array(llmSetSchema).min(1),
  rest_duration_seconds: z.number().int().min(15).max(300),
  notes: z.string().nullable(),
});

export const llmResponseSchema = z.object({
  workout_name: z.string().min(1).max(100),
  exercises: z.array(llmExerciseSchema).min(1),
});

export const generatedSetSchema = z.object({
  set_type: z.enum(["warmup", "working"]),
  target_load_kg: z.number().min(0),
  target_reps: z.number().int().min(1),
});

export const progressionTypeSchema = z.enum([
  "weight_up",
  "reps_up",
  "maintained",
  "new_exercise",
]);

export const generatedExerciseSchema = z.object({
  exercise_id: z.string().uuid(),
  exercise_name: z.string(),
  sets: z.array(generatedSetSchema).min(1),
  rest_duration_seconds: z.number().int().min(15).max(300),
  notes: z.string().nullable(),
  progression_type: progressionTypeSchema.nullable().optional(),
  previous_display: z.string().nullable().optional(),
});

export const generateWorkoutResponseSchema = z.object({
  workout_name: z.string(),
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
  primary_muscles: string[];
  secondary_muscles: string[] | null;
  equipment: string[];
  difficulty_level: string | null;
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
    difficulty_feedback: string | null;
    sets: {
      set_type: string;
      target_load_kg: number;
      target_reps: number;
      log: {
        actual_load_kg: number | null;
        actual_reps: number | null;
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

export interface QueueContextItem {
  queue_position: number;
  focus_area: string | null;
  workout_data: {
    workout_name: string;
    exercises: {
      exercise_name: string;
      sets: { target_load_kg: number; target_reps: number }[];
    }[];
  } | null;
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
  queueContext?: QueueContextItem[];
  history?: HistorySession[];
  exercisePreferences?: ExercisePreference[];
}

export interface ExercisePreference {
  exercise_id: string;
  preference: string;
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
          const setsSummary = ex.sets
            .filter((set) => set.log?.completed)
            .map(
              (set) =>
                `${set.log?.actual_load_kg ?? set.target_load_kg}kg×${set.log?.actual_reps ?? set.target_reps}`
            )
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
            .map((s) => `${s.target_load_kg}kg×${s.target_reps}`)
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

// ---------------------------------------------------------------------------
// Helper: Format Exercise Preferences for Prompt
// ---------------------------------------------------------------------------

function formatPreferences(preferences: ExercisePreference[]): string {
  const preferred = preferences
    .filter((p) => p.preference === "preferred")
    .map((p) => p.exercise_id);
  const softDisliked = preferences
    .filter((p) => p.preference === "soft_dislike")
    .map((p) => p.exercise_id);

  const sections: string[] = [];

  if (preferred.length > 0) {
    sections.push(
      "## Preferred Exercises (IDs the user wants to see more often)",
      preferred.join(", "),
      "Prioritize these exercises when they fit the workout's focus. Select them over equivalent alternatives when possible."
    );
  }

  if (softDisliked.length > 0) {
    sections.push(
      "## Deprioritized Exercises (IDs the user wants to see less often)",
      softDisliked.join(", "),
      "Avoid selecting these exercises unless no good alternatives exist for the target muscle group."
    );
  }

  return sections.join("\n");
}

// ---------------------------------------------------------------------------
// Prompt Builder
// ---------------------------------------------------------------------------

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
  exercisePreferences?: ExercisePreference[]
): { system: string; user: string } {
  const counts = EXERCISE_COUNTS[durationMinutes] ?? { min: 5, max: 7 };

  const exerciseList = catalog
    .map(
      (e) =>
        `- ID: ${e.id} | Name: ${e.name} | Muscles: ${e.primary_muscles.join(", ")} | Equipment: ${e.equipment.join(", ") || "bodyweight"} | Difficulty: ${e.difficulty_level ?? "unknown"}`
    )
    .join("\n");

  const system = `You are a certified personal trainer creating a workout plan.
You MUST respond with valid JSON matching the exact schema below. No extra text, no markdown.
Select exercises ONLY from the provided exercise catalog using their exact IDs.
Design for progressive overload based on the user's history.

Response JSON schema:
{
  "workout_name": "string — creative, motivating workout name",
  "exercises": [
    {
      "exercise_id": "string — UUID from the catalog",
      "sets": [
        {
          "set_type": "warmup | working",
          "target_load_kg": "number — weight in kg",
          "target_reps": "number — target repetitions"
        }
      ],
      "rest_duration_seconds": "number — rest between sets (30-180)",
      "notes": "string | null — brief coaching tip if technique matters"
    }
  ]
}`;

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
  const preferencesSection = exercisePreferences?.length
    ? `\n\n${formatPreferences(exercisePreferences)}`
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
- Match exercises to the "${equipment.replace(/_/g, " ")}" equipment level
- Tailor set/rep schemes to "${trainingStyle}" style (strength: heavy/low reps, hypertrophy: moderate/8-12 reps, endurance: light/high reps, circuit: varied/minimal rest)
- Adjust complexity and load for "${difficulty}" level
- For "${splitLabel}" split, choose an appropriate muscle group focus for today's session
- Include 1 warmup set per compound exercise (lower weight, higher reps)
- Progressive overload: if user completed previous load and feedback was "ok" or "too_easy", increase by 2.5-5kg
- If feedback was "too_hard", maintain or slightly reduce load
- For new exercises (no history), use moderate starting weights
- Generate a creative, motivating workout name

## Recent Workout History
${summarizeHistory(history)}

## Exercise Catalog
${exerciseList}${preferencesSection}${baselinesSection}${queueContextSection}${customSection}`;

  return { system, user };
}

// ---------------------------------------------------------------------------
// Fallback Workout Builder
// ---------------------------------------------------------------------------

export function buildFallbackWorkout(
  catalog: ExerciseCatalogEntry[],
  trainingSplit: string,
  durationMinutes: number,
  trainingStyle: string
): z.infer<typeof llmResponseSchema> {
  const counts = EXERCISE_COUNTS[durationMinutes] ?? { min: 5, max: 7 };

  const styleSchemes: Record<
    string,
    { sets: number; reps: number; rest: number }
  > = {
    strength: { sets: 4, reps: 5, rest: 120 },
    hypertrophy: { sets: 3, reps: 10, rest: 90 },
    endurance: { sets: 3, reps: 15, rest: 45 },
    circuit: { sets: 3, reps: 12, rest: 30 },
  };
  const scheme = styleSchemes[trainingStyle] ?? styleSchemes.hypertrophy;

  const shuffled = [...catalog].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, counts.max);
  const splitLabel = trainingSplit.replace(/_/g, " ");

  return {
    workout_name: `${splitLabel.charAt(0).toUpperCase() + splitLabel.slice(1)} Workout`,
    exercises: selected.map((ex) => {
      const isCompound =
        ex.primary_muscles.length > 1 ||
        ["barbell", "dumbbell"].some((eq) =>
          ex.equipment.some((e) => e.toLowerCase().includes(eq))
        );

      const warmupSets: z.infer<typeof llmSetSchema>[] = isCompound
        ? [{ set_type: "warmup" as const, target_load_kg: 0, target_reps: 10 }]
        : [];

      const workingSets: z.infer<typeof llmSetSchema>[] = Array.from(
        { length: scheme.sets },
        () => ({
          set_type: "working" as const,
          target_load_kg: 0,
          target_reps: scheme.reps,
        })
      );

      return {
        exercise_id: ex.id,
        sets: [...warmupSets, ...workingSets],
        rest_duration_seconds: scheme.rest,
        notes: null,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Exercise Catalog Fetcher
// ---------------------------------------------------------------------------

export async function fetchExerciseCatalog(
  supabaseClient: SupabaseClient,
  equipment: string,
  hardDislikedIds?: Set<string>
): Promise<ExerciseCatalogEntry[]> {
  let exerciseQuery = supabaseClient
    .from("exercises")
    .select(
      "id, name, primary_muscles, secondary_muscles, equipment, difficulty_level"
    );

  if (equipment === "bodyweight") {
    exerciseQuery = exerciseQuery.contains("equipment", ["bodyweight"]);
  } else if (equipment === "dumbbells") {
    exerciseQuery = exerciseQuery.overlaps("equipment", [
      "bodyweight",
      "dumbbells",
    ]);
  } else if (equipment === "barbell") {
    exerciseQuery = exerciseQuery.overlaps("equipment", [
      "bodyweight",
      "dumbbells",
      "barbell",
    ]);
  }
  // "full_gym" — no filter needed

  const { data, error } = await exerciseQuery.order("name").limit(100);
  if (error || !data?.length) return [];

  if (hardDislikedIds && hardDislikedIds.size > 0) {
    return (data as ExerciseCatalogEntry[]).filter(
      (e) => !hardDislikedIds.has(e.id)
    );
  }

  return data as ExerciseCatalogEntry[];
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
    exercisePreferences,
  } = params;

  // Build hard-disliked set for catalog filtering
  const hardDislikedIds = new Set(
    (exercisePreferences ?? [])
      .filter((p) => p.preference === "hard_dislike")
      .map((p) => p.exercise_id)
  );

  // Remaining preferences (preferred + soft_dislike) for prompt injection
  const promptPreferences = (exercisePreferences ?? []).filter(
    (p) => p.preference !== "hard_dislike"
  );

  // Fetch exercise catalog (hard-disliked exercises excluded)
  const catalog = await fetchExerciseCatalog(
    supabaseClient,
    equipment,
    hardDislikedIds.size > 0 ? hardDislikedIds : undefined
  );
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
        promptPreferences.length > 0 ? promptPreferences : undefined
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
          max_tokens: 2000,
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
        trainingStyle
      );
      generationSource = "fallback_template";
    }
  } else {
    workoutData = buildFallbackWorkout(
      catalog,
      trainingSplit,
      durationMinutes,
      trainingStyle
    );
    generationSource = "fallback_template";
  }

  // Enrich with exercise names
  const enrichedExercises = workoutData.exercises.map((ex) => {
    const catalogEntry = catalogMap.get(ex.exercise_id);
    return {
      exercise_id: ex.exercise_id,
      exercise_name: catalogEntry?.name ?? "Unknown Exercise",
      sets: ex.sets,
      rest_duration_seconds: ex.rest_duration_seconds,
      notes: ex.notes,
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
                set.target_load_kg = result.target_load_kg;
                set.target_reps = result.target_reps;
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

  const profileGoal = profile.goal ?? "improve_fitness";

  const response = generateWorkoutResponseSchema.parse({
    workout_name: workoutData.workout_name,
    generation_source: generationSource,
    goal_snapshot: profileGoal,
    custom_goal_snapshot: profile.custom_goal ?? null,
    exercises: enrichedExercises,
  });

  return { success: true, data: response, generationSource };
}
