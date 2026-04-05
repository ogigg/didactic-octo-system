import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import {
  generateSingleWorkout,
  type HistorySession,
  type ProfileData,
  type QueueContextItem,
  type StrengthBaseline,
} from "../_shared/generator.ts";

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const RATE_LIMIT_SECONDS = 30;

// -----------------------------------------------------------------------------
// Request Schema
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
  // Regeneration: identifies a pending workout slot to replace
  pending_workout_id: z.string().uuid().optional(),
});

// -----------------------------------------------------------------------------
// Main Handler
// -----------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  console.log("[generate-workout] Request received", {
    method: req.method,
    url: req.url,
  });

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  try {
    // 1. Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("Missing authorization header", 401);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(token);

    if (authError || !user) return errorResponse("Unauthorized", 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // 2. Parse and validate request
    const body = await req.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
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
      pending_workout_id,
    } = parsed.data;

    // 3. Rate limiting (skip for pending workout regeneration — has its own daily limit)
    if (!pending_workout_id) {
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
          return jsonResponse(
            {
              error: "Rate limited",
              retry_after: Math.ceil(RATE_LIMIT_SECONDS - elapsed),
            },
            429
          );
        }
      }
    }

    // 4. Daily regeneration limit for pending workouts
    if (pending_workout_id) {
      const { data: pendingWorkout } = await userClient
        .from("pending_workouts")
        .select("id, last_regenerated_at, user_id")
        .eq("id", pending_workout_id)
        .eq("user_id", user.id)
        .single();

      if (!pendingWorkout) {
        return errorResponse("Pending workout not found", 404);
      }

      if (pendingWorkout.last_regenerated_at) {
        const lastRegen = new Date(pendingWorkout.last_regenerated_at);
        const now = new Date();
        const sameDay =
          lastRegen.getFullYear() === now.getFullYear() &&
          lastRegen.getMonth() === now.getMonth() &&
          lastRegen.getDate() === now.getDate();

        if (sameDay) {
          return errorResponse(
            "Daily regeneration limit reached. Try again tomorrow or edit the workout instead.",
            429
          );
        }
      }
    }

    // 5. Fetch profile
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

    const profileGoal: string = profile.goal ?? "improve_fitness";

    // 6. Fetch recent workout history (last 4 completed sessions)
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
        if (detail) history.push(detail as HistorySession);
      }
    }

    // 7. Fetch strength baselines
    const { data: baselines } = await userClient
      .from("strength_baselines")
      .select("exercise_key, load_kg, reps")
      .eq("user_id", user.id);

    const strengthBaselines: StrengthBaseline[] =
      (baselines as StrengthBaseline[] | null) ?? [];

    // 8. Fetch queue context (other pending workouts — for exercise variety during regeneration)
    let queueContext: QueueContextItem[] | undefined;
    if (pending_workout_id) {
      const { data: otherPending } = await userClient
        .from("pending_workouts")
        .select("queue_position, focus_area, workout_data")
        .eq("user_id", user.id)
        .neq("id", pending_workout_id)
        .eq("status", "ready")
        .order("queue_position");

      if (otherPending?.length) {
        queueContext = otherPending.map((pw) => ({
          queue_position: pw.queue_position,
          focus_area: pw.focus_area,
          workout_data: pw.workout_data as QueueContextItem["workout_data"],
        }));
      }
    }

    // 9. Generate workout
    const result = await generateSingleWorkout({
      supabaseClient: userClient,
      userId: user.id,
      profile: { ...profile, goal: profileGoal } as ProfileData,
      trainingSplit: training_split,
      durationMinutes: duration_minutes,
      equipment,
      trainingStyle: training_style,
      difficulty,
      customPrompt: custom_prompt,
      strengthBaselines:
        strengthBaselines.length > 0 ? strengthBaselines : undefined,
      queueContext,
      history,
    });

    if (!result.success || !result.data) {
      return errorResponse(result.error ?? "Workout generation failed", 500);
    }

    // 10. If regenerating a pending workout, update it
    if (pending_workout_id) {
      const { data: currentPW } = await userClient
        .from("pending_workouts")
        .select("regeneration_count")
        .eq("id", pending_workout_id)
        .single();

      await userClient
        .from("pending_workouts")
        .update({
          workout_data: result.data as unknown as Record<string, unknown>,
          generation_source: result.generationSource,
          status: "ready",
          last_regenerated_at: new Date().toISOString(),
          regeneration_count: (currentPW?.regeneration_count ?? 0) + 1,
          generated_at: new Date().toISOString(),
        })
        .eq("id", pending_workout_id)
        .eq("user_id", user.id);
    }

    console.log("[generate-workout] Success!", {
      generationSource: result.generationSource,
      exerciseCount: result.data.exercises.length,
      pendingWorkoutRegenerated: !!pending_workout_id,
    });

    return jsonResponse(result.data);
  } catch (err) {
    console.error("[generate-workout] Unhandled error:", err);
    return errorResponse("Internal server error", 500);
  }
});
