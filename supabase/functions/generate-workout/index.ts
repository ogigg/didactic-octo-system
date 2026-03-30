import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "z-ai/glm-4.7-flash";
const LLM_TIMEOUT_MS = 15_000;
const RATE_LIMIT_SECONDS = 30;

const EXERCISE_COUNTS: Record<number, { min: number; max: number }> = {
  15: { min: 3, max: 4 },
  30: { min: 4, max: 6 },
  45: { min: 5, max: 7 },
  60: { min: 6, max: 9 },
  90: { min: 8, max: 12 },
};

// -----------------------------------------------------------------------------
// Zod Schemas
// -----------------------------------------------------------------------------

const requestSchema = z.object({
  training_split: z.enum(["full_body", "upper_lower", "push_pull_legs"]),
  duration_minutes: z.union([
    z.literal(15),
    z.literal(30),
    z.literal(45),
    z.literal(60),
    z.literal(90),
  ]),
  equipment: z.enum(["bodyweight", "dumbbells", "barbell", "full_gym"]),
  training_style: z.enum(["strength", "hypertrophy", "endurance", "circuit"]),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  custom_prompt: z.string().max(500).optional(),
});

const llmSetSchema = z.object({
  set_type: z.enum(["warmup", "working"]),
  target_load_kg: z.number().min(0),
  target_reps: z.number().int().min(1),
});

const llmExerciseSchema = z.object({
  exercise_id: z.string().uuid(),
  sets: z.array(llmSetSchema).min(1),
  rest_duration_seconds: z.number().int().min(15).max(300),
  notes: z.string().nullable(),
});

const llmResponseSchema = z.object({
  workout_name: z.string().min(1).max(100),
  exercises: z.array(llmExerciseSchema).min(1),
});

const generatedSetSchema = z.object({
  set_type: z.enum(["warmup", "working"]),
  target_load_kg: z.number().min(0),
  target_reps: z.number().int().min(1),
});

const generatedExerciseSchema = z.object({
  exercise_id: z.string().uuid(),
  exercise_name: z.string(),
  sets: z.array(generatedSetSchema).min(1),
  rest_duration_seconds: z.number().int().min(15).max(300),
  notes: z.string().nullable(),
});

const generateWorkoutResponseSchema = z.object({
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

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface ExerciseCatalogEntry {
  id: string;
  name: string;
  primary_muscles: string[];
  secondary_muscles: string[] | null;
  equipment: string[];
  difficulty_level: string | null;
}

interface ProfileData {
  goal: string;
  custom_goal: string | null;
  weekly_frequency: string;
  gender: string | null;
}

interface HistorySession {
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

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status: number): Response {
  return jsonResponse({ error: message }, status);
}

function summarizeHistory(sessions: HistorySession[]): string {
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

function buildPrompt(
  profile: ProfileData,
  trainingSplit: string,
  durationMinutes: number,
  equipment: string,
  trainingStyle: string,
  difficulty: string,
  customPrompt: string | undefined,
  catalog: ExerciseCatalogEntry[],
  history: HistorySession[]
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
- Select ${counts.min}-${counts.max} exercises

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
${exerciseList}${customSection}`;

  return { system, user };
}

function buildFallbackWorkout(
  catalog: ExerciseCatalogEntry[],
  trainingSplit: string,
  durationMinutes: number,
  trainingStyle: string
): z.infer<typeof llmResponseSchema> {
  const counts = EXERCISE_COUNTS[durationMinutes] ?? { min: 5, max: 7 };

  // Map training style to set/rep scheme
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

  // Pick exercises up to max count, shuffled
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
        ? [
            {
              set_type: "warmup" as const,
              target_load_kg: 0,
              target_reps: 10,
            },
          ]
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

// -----------------------------------------------------------------------------
// Main Handler
// -----------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  console.log("[generate-workout] Request received", {
    method: req.method,
    url: req.url,
  });

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    console.log("[generate-workout] CORS preflight request");
    return new Response("ok", { headers: corsHeaders() });
  }

  try {
    console.log("[generate-workout] Processing request");
    // 1. Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse("Missing authorization header", 401);
    }

    console.log("[generate-workout] Creating Supabase client for auth check", {
      supabaseUrl: Deno.env.get("SUPABASE_URL"),
      hasAuthHeader: !!authHeader,
    });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const token = authHeader.replace("Bearer ", "");
    console.log("[generate-workout] Calling getUser()...");
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(token);
    console.log("[generate-workout] getUser() result", {
      user: !!user,
      authError: authError?.message,
    });

    if (authError || !user) {
      console.log("[generate-workout] Auth check failed, returning 401");
      return errorResponse("Unauthorized", 401);
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // 2. Parse and validate request
    const body = await req.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      console.error("[generate-workout] Invalid request:", parsed.error);
      return errorResponse(
        `Invalid request: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
        400
      );
    }

    const {
      training_split,
      duration_minutes,
      equipment,
      training_style,
      difficulty,
      custom_prompt,
    } = parsed.data;

    // 3. Rate limiting — check last generation timestamp
    const { data: recentSession } = await userClient
      .from("workout_sessions")
      .select("created_at")
      .eq("user_id", user.id)
      .in("generation_source", ["llm", "fallback_substitution"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (recentSession) {
      const elapsed =
        (Date.now() - new Date(recentSession.created_at).getTime()) / 1000;
      if (elapsed < RATE_LIMIT_SECONDS) {
        console.log("[generate-workout] Rate limited, returning 429");
        return jsonResponse(
          {
            error: "Rate limited",
            retry_after: Math.ceil(RATE_LIMIT_SECONDS - elapsed),
          },
          429
        );
      }
    }

    // 4. Fetch profile
    const { data: profile, error: profileError } = await userClient
      .from("profiles")
      .select("goal, custom_goal, weekly_frequency, gender")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return errorResponse(
        "Profile not found. Complete onboarding first.",
        400
      );
    }

    // Default goal if null (user skipped or hasn't completed onboarding fully)
    const profileGoal: string = profile.goal ?? "improve_fitness";

    // 5. Fetch recent workout history (last 4 completed sessions)
    const { data: recentSessions } = await userClient
      .from("workout_sessions")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(4);

    const history: HistorySession[] = [];
    if (recentSessions?.length) {
      for (const session of recentSessions) {
        const { data: detail } = await userClient.rpc(
          "get_workout_session_detail",
          { p_session_id: session.id }
        );
        if (detail) {
          history.push(detail as HistorySession);
        }
      }
    }

    // 6. Fetch exercise catalog filtered by equipment availability
    let exerciseQuery = userClient
      .from("exercises")
      .select(
        "id, name, primary_muscles, secondary_muscles, equipment, difficulty_level"
      );

    // Filter by equipment: users with less equipment shouldn't see exercises
    // requiring gear they don't have. "full_gym" means no filter needed.
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

    const { data: exercises, error: exerciseError } = await exerciseQuery
      .order("name")
      .limit(100);

    if (exerciseError || !exercises?.length) {
      return errorResponse("No exercises found for this focus area", 400);
    }

    const catalog = exercises as ExerciseCatalogEntry[];
    const catalogMap = new Map(catalog.map((e) => [e.id, e]));

    // 7. Try LLM generation
    const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
    let generationSource:
      | "llm"
      | "fallback_template"
      | "fallback_substitution" = "llm";
    let workoutData: z.infer<typeof llmResponseSchema>;

    if (openrouterKey) {
      try {
        console.log(
          "[generate-workout] OpenRouter API key found, attempting LLM generation",
          {
            url: OPENROUTER_URL,
            model: OPENROUTER_MODEL,
            catalogSize: catalog.length,
            historyLength: history.length,
          }
        );

        const prompt = buildPrompt(
          { ...profile, goal: profileGoal } as ProfileData,
          training_split,
          duration_minutes,
          equipment,
          training_style,
          difficulty,
          custom_prompt,
          catalog,
          history
        );

        console.log("[generate-workout] Prompt built, calling OpenRouter API");

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

        console.log("[generate-workout] OpenRouter response received", {
          status: llmResponse.status,
          statusText: llmResponse.statusText,
          ok: llmResponse.ok,
        });

        if (!llmResponse.ok) {
          const errorBody = await llmResponse.text();
          console.error("[generate-workout] OpenRouter error response:", {
            status: llmResponse.status,
            body: errorBody.slice(0, 500),
          });
          throw new Error(
            `OpenRouter returned ${llmResponse.status}: ${errorBody.slice(0, 200)}`
          );
        }

        const llmJson = await llmResponse.json();
        const content = llmJson.choices?.[0]?.message?.content;

        console.log("[generate-workout] LLM response parsed", {
          hasContent: !!content,
          hasChoices: !!llmJson.choices?.length,
          contentLength: content?.length ?? 0,
        });

        if (!content) {
          throw new Error("Empty LLM response");
        }

        const parsedContent = JSON.parse(content);
        console.log("[generate-workout] Parsed LLM JSON", {
          exerciseCount: parsedContent.exercises?.length ?? 0,
          workoutName: parsedContent.workout_name,
        });
        workoutData = llmResponseSchema.parse(parsedContent);

        // 8. Validate exercise IDs and substitute invalid ones
        let hasSubstitutions = false;
        for (let i = 0; i < workoutData.exercises.length; i++) {
          const ex = workoutData.exercises[i];
          if (!catalogMap.has(ex.exercise_id)) {
            // Substitute with a random valid exercise
            const replacement =
              catalog[Math.floor(Math.random() * catalog.length)];
            workoutData.exercises[i] = {
              ...ex,
              exercise_id: replacement.id,
            };
            hasSubstitutions = true;
          }
        }

        if (hasSubstitutions) {
          generationSource = "fallback_substitution";
        }
      } catch (err) {
        console.error("LLM generation failed:", {
          error: err instanceof Error ? err.message : String(err),
          errorType: err?.constructor?.name,
          apiKeyExists: !!openrouterKey,
          apiKeyLength: openrouterKey?.length,
        });
        // LLM failed — fall back to rule-based template
        workoutData = buildFallbackWorkout(
          catalog,
          training_split,
          duration_minutes,
          training_style
        );
        generationSource = "fallback_template";
      }
    } else {
      console.warn("OPENROUTER_API_KEY not set — using fallback template");
      // No API key — use fallback
      workoutData = buildFallbackWorkout(
        catalog,
        training_split,
        duration_minutes,
        training_style
      );
      generationSource = "fallback_template";
    }

    // 9. Enrich with exercise names and build response
    const enrichedExercises = workoutData.exercises.map((ex) => {
      const catalogEntry = catalogMap.get(ex.exercise_id);
      return {
        exercise_id: ex.exercise_id,
        exercise_name: catalogEntry?.name ?? "Unknown Exercise",
        sets: ex.sets,
        rest_duration_seconds: ex.rest_duration_seconds,
        notes: ex.notes,
      };
    });

    const response = generateWorkoutResponseSchema.parse({
      workout_name: workoutData.workout_name,
      generation_source: generationSource,
      goal_snapshot: profileGoal,
      custom_goal_snapshot: profile.custom_goal ?? null,
      exercises: enrichedExercises,
    });

    console.log("[generate-workout] Success! Returning response", {
      generationSource,
      exerciseCount: response.exercises.length,
    });

    return jsonResponse(response);
  } catch (err) {
    console.error("[generate-workout] Unhandled error:", err);
    return errorResponse("Internal server error", 500);
  }
});
