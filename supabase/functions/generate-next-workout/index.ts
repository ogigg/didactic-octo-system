import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import {
  determineReplacementFocusArea,
  generateSingleWorkout,
  type ExercisePreference,
  type HistorySession,
  type ProfileData,
  type QueueContextItem,
  type StrengthBaseline,
} from "../_shared/generator.ts";

// ---------------------------------------------------------------------------
// Request Schema
// ---------------------------------------------------------------------------

const payloadSchema = z.object({
  user_id: z.string().uuid(),
  completed_session_id: z.string().uuid(),
});

// Frequency mapping
const FREQUENCY_MAP: Record<string, number> = {
  "2": 2,
  "3": 3,
  "4": 4,
  "5_plus": 5,
};

// ---------------------------------------------------------------------------
// Main Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  console.log("[generate-next-workout] Request received");

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  try {
    // 1. Verify service role key (called by database webhook)
    const authHeader = req.headers.get("Authorization");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!authHeader || authHeader.replace("Bearer ", "") !== serviceRoleKey) {
      return errorResponse("Unauthorized — invalid service role key", 401);
    }

    // 2. Parse payload
    const body = await req.json();
    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        `Invalid payload: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
        400
      );
    }
    const { user_id, completed_session_id } = parsed.data;

    console.log(
      `[generate-next-workout] User ${user_id}, completed session ${completed_session_id}`
    );

    // Use service role client (bypasses RLS — this is a server-side operation)
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      serviceRoleKey,
      { auth: { persistSession: false } }
    );

    // 3. Fetch user profile with preferences
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select(
        "goal, custom_goal, weekly_frequency, gender, training_split, session_duration_minutes, equipment_level, training_style, difficulty_level, training_custom_prompt, training_setup_completed"
      )
      .eq("id", user_id)
      .single();

    if (profileError || !profile?.training_setup_completed) {
      console.log(
        "[generate-next-workout] User not set up for auto-generation, skipping"
      );
      return jsonResponse({ skipped: true, reason: "training_not_set_up" });
    }

    const targetCount = FREQUENCY_MAP[profile.weekly_frequency] ?? 4;

    // 4. Get current pending_workouts
    const { data: currentQueue } = await supabaseClient
      .from("pending_workouts")
      .select("id, queue_position, status, focus_area, workout_data")
      .eq("user_id", user_id)
      .order("queue_position");

    const currentCount = currentQueue?.length ?? 0;

    // If queue is already full, no replacement needed
    if (currentCount >= targetCount) {
      console.log(
        `[generate-next-workout] Queue full (${currentCount}/${targetCount}), skipping`
      );
      return jsonResponse({ skipped: true, reason: "queue_full" });
    }

    // 5. Fetch strength baselines
    const { data: baselines } = await supabaseClient
      .from("strength_baselines")
      .select("exercise_key, load_kg, reps")
      .eq("user_id", user_id);

    const strengthBaselines: StrengthBaseline[] =
      (baselines as StrengthBaseline[] | null) ?? [];

    // 6. Fetch recent workout history (including just-completed session)
    const { data: recentSessions } = await supabaseClient
      .from("workout_sessions")
      .select("id")
      .eq("user_id", user_id)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(4);

    const history: HistorySession[] = [];
    if (recentSessions?.length) {
      for (const session of recentSessions) {
        const { data: detail } = await supabaseClient.rpc(
          "get_workout_session_detail",
          { p_session_id: session.id }
        );
        if (detail) history.push(detail as HistorySession);
      }
    }

    // 7. Determine position and focus area for the replacement
    const maxPosition = Math.max(
      0,
      ...(currentQueue?.map((pw) => pw.queue_position) ?? [])
    );
    const targetPosition = maxPosition + 1;

    const readyWorkouts = (currentQueue ?? []).filter(
      (pw) => pw.status === "ready"
    );

    const focusArea = determineReplacementFocusArea(
      profile.training_split,
      readyWorkouts
    );

    // Build queue context from existing pending workouts
    const queueContext: QueueContextItem[] = (currentQueue ?? [])
      .filter((pw) => pw.status === "ready" && pw.workout_data)
      .map((pw) => ({
        queue_position: pw.queue_position,
        focus_area: pw.focus_area,
        workout_data: pw.workout_data as QueueContextItem["workout_data"],
      }));

    // 8. Fetch exercise preferences
    const { data: prefRows } = await supabaseClient
      .from("exercise_preferences")
      .select("exercise_id, preference")
      .eq("user_id", user_id);

    const exercisePreferences: ExercisePreference[] =
      (prefRows as ExercisePreference[] | null) ?? [];

    // 9. Insert placeholder row so the client can show a "generating" card
    const profileGoal = profile.goal ?? "improve_fitness";

    const { data: placeholder, error: placeholderError } = await supabaseClient
      .from("pending_workouts")
      .insert({
        user_id,
        queue_position: targetPosition,
        status: "generating",
        focus_area: focusArea,
      })
      .select("id")
      .single();

    if (placeholderError || !placeholder) {
      console.error(
        "[generate-next-workout] Error creating placeholder:",
        placeholderError
      );
      return errorResponse("Failed to create placeholder", 500);
    }

    // 10. Generate replacement workout
    const genResult = await generateSingleWorkout({
      supabaseClient,
      userId: user_id,
      profile: { ...profile, goal: profileGoal } as ProfileData,
      trainingSplit: profile.training_split,
      durationMinutes: profile.session_duration_minutes ?? 45,
      equipment: profile.equipment_level,
      trainingStyle: profile.training_style,
      difficulty: profile.difficulty_level,
      customPrompt: profile.training_custom_prompt ?? undefined,
      focusArea,
      strengthBaselines,
      queueContext: queueContext.length > 0 ? queueContext : undefined,
      history,
      exercisePreferences:
        exercisePreferences.length > 0 ? exercisePreferences : undefined,
    });

    if (!genResult.success || !genResult.data) {
      console.error(
        `[generate-next-workout] Generation failed: ${genResult.error}`
      );

      await supabaseClient
        .from("pending_workouts")
        .update({ status: "failed" })
        .eq("id", placeholder.id);

      return jsonResponse({ success: false, error: genResult.error }, 500);
    }

    // 11. Update placeholder with generated data
    const { error: insertError } = await supabaseClient
      .from("pending_workouts")
      .update({
        status: "ready",
        workout_data: genResult.data as unknown as Record<string, unknown>,
        generation_source: genResult.generationSource,
        generated_at: new Date().toISOString(),
      })
      .eq("id", placeholder.id);

    if (insertError) {
      console.error(
        "[generate-next-workout] Error inserting replacement:",
        insertError
      );
      return errorResponse("Failed to save replacement workout", 500);
    }

    console.log(
      `[generate-next-workout] Replacement generated: user ${user_id}, position ${targetPosition}, focus ${focusArea}`
    );

    return jsonResponse({
      success: true,
      queue_position: targetPosition,
      focus_area: focusArea,
      generation_source: genResult.generationSource,
    });
  } catch (err) {
    console.error("[generate-next-workout] Unhandled error:", err);
    return errorResponse("Internal server error", 500);
  }
});
