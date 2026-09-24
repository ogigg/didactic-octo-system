import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import {
  createGenerationTrace,
  generationFetch,
  type GenerationTrace,
} from "../_shared/generation-trace.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import {
  GENERATION_BUDGET_MS,
  determineReplacementFocusArea,
  generateSingleWorkout,
  type ExercisePreference,
  type HistorySession,
  type ProfileData,
  type QueueContextItem,
  type RecentSessionComment,
  type StrengthBaseline,
} from "../_shared/generator.ts";
import {
  checkGenerationAllowance,
  recordGenerationUsage,
} from "../_shared/subscription.ts";

// ---------------------------------------------------------------------------
// Request Schema
// ---------------------------------------------------------------------------

const payloadSchema = z.object({
  user_id: z.string().uuid(),
  completed_session_id: z.string().uuid(),
});

// Frequency mapping
const FREQUENCY_MAP: Record<string, number> = {
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5_plus": 5,
};

// ---------------------------------------------------------------------------
// Main Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  const deadlineAt = Date.now() + GENERATION_BUDGET_MS;
  console.log("[generate-next-workout] Request received");

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  let trace: GenerationTrace | undefined;
  let saved = false;
  const pendingWorkoutId = crypto.randomUUID();
  let recoveryClient: SupabaseClient | undefined;
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
      { auth: { persistSession: false }, global: { fetch: generationFetch } }
    );

    recoveryClient = supabaseClient;
    const { error: recoveryError } = await supabaseClient.rpc(
      "recover_stale_generation_attempts",
      { p_user_id: user_id }
    );
    if (recoveryError) throw recoveryError;
    trace = await createGenerationTrace(supabaseClient, {
      deadlineAt,
      requestId: completed_session_id,
      userId: user_id,
      pendingWorkoutId,
      functionName: "generate-next-workout",
      trigger: "auto_completion",
    });
    if (trace.claimStatus && trace.claimStatus !== "claimed") {
      return jsonResponse({
        skipped: true,
        reason: trace.claimStatus,
        request_id: trace.requestId,
      });
    }
    await trace.stage("context");
    // 3. Fetch user profile with preferences
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select(
        "goal, custom_goal, weekly_frequency, gender, training_split, session_duration_minutes, equipment_level, training_style, difficulty_level, training_custom_prompt, weight_increments, training_setup_completed"
      )
      .eq("id", user_id)
      .single();

    if (profileError || !profile?.training_setup_completed) {
      console.log(
        "[generate-next-workout] User not set up for auto-generation, skipping"
      );
      await trace.finish("rejected", {
        error_code: "training_not_set_up",
        error_message: profileError?.message ?? "Training setup incomplete",
      });
      return jsonResponse({
        skipped: true,
        reason: "training_not_set_up",
        request_id: trace.requestId,
      });
    }

    // 4. Check generation allowance — silently skip if limit reached
    await trace.stage("allowance");
    const allowance = await checkGenerationAllowance(
      supabaseClient,
      user_id,
      1
    );
    if (!allowance.allowed) {
      await trace.finish("rejected", {
        error_code: "generation_limit_reached",
        error_message: "Generation allowance exhausted",
      });
      console.log(
        `[generate-next-workout] Generation limit reached for user ${user_id}: ${allowance.used}/5 used this week. Skipping.`
      );
      return jsonResponse({
        skipped: true,
        reason: "generation_limit_reached",
      });
    }

    const targetCount = FREQUENCY_MAP[profile.weekly_frequency] ?? 4;

    // 5. Get current pending_workouts
    await trace.stage("queue_context");
    const { data: currentQueue, error: queueError } = await supabaseClient
      .from("pending_workouts")
      .select("id, queue_position, status, focus_area, workout_data")
      .eq("user_id", user_id)
      .order("queue_position");

    if (queueError) throw queueError;
    const currentCount = currentQueue?.length ?? 0;

    // If queue is already full, no replacement needed — renumbered from step 4
    if (currentCount >= targetCount) {
      console.log(
        `[generate-next-workout] Queue full (${currentCount}/${targetCount}), skipping`
      );
      await trace.finish("rejected", {
        error_code: "queue_full",
        error_message: "Queue already contains the required workouts",
      });
      return jsonResponse({
        skipped: true,
        reason: "queue_full",
        request_id: trace.requestId,
      });
    }

    // 5–6, 8. These reads do not depend on each other once the queue has been
    // loaded. Resolve history details concurrently while retaining the query
    // order returned by the database.
    const [baselinesResult, historyResult, preferencesResult, commentsResult] =
      await Promise.all([
        supabaseClient
          .from("strength_baselines")
          .select("exercise_key, load_kg, reps")
          .eq("user_id", user_id),
        supabaseClient
          .from("workout_sessions")
          .select("id")
          .eq("user_id", user_id)
          .eq("status", "completed")
          .order("completed_at", { ascending: false })
          .limit(4),
        supabaseClient
          .from("exercise_preferences")
          .select("exercise_id, preference")
          .eq("user_id", user_id),
        supabaseClient
          .from("workout_session_comments")
          .select("comment, created_at")
          .eq("user_id", user_id)
          .order("created_at", { ascending: false })
          .limit(3),
      ]);

    if (baselinesResult.error)
      throw new Error("baselinesError: " + baselinesResult.error.message);
    if (historyResult.error)
      throw new Error("historyError: " + historyResult.error.message);
    if (preferencesResult.error)
      throw new Error("preferencesError: " + preferencesResult.error.message);
    if (commentsResult.error)
      throw new Error("commentsError: " + commentsResult.error.message);

    const historyDetails = await Promise.all(
      (historyResult.data ?? []).map(async (session) => {
        const { data: detail, error: detailError } = await supabaseClient.rpc(
          "get_workout_session_detail",
          { p_session_id: session.id }
        );
        if (detailError)
          throw new Error("history detail: " + detailError.message);
        return detail as HistorySession | null;
      })
    );
    const history: HistorySession[] = historyDetails.filter(
      (detail): detail is HistorySession => detail !== null
    );
    const strengthBaselines: StrengthBaseline[] =
      (baselinesResult.data as StrengthBaseline[] | null) ?? [];

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

    const exercisePreferences: ExercisePreference[] =
      (preferencesResult.data as ExercisePreference[] | null) ?? [];
    const recentComments: RecentSessionComment[] =
      (commentsResult.data as RecentSessionComment[] | null) ?? [];

    // 9. Insert placeholder row so the client can show a "generating" card
    const profileGoal = profile.goal ?? "improve_fitness";

    await trace.stage("placeholder");
    const { data: placeholder, error: placeholderError } = await supabaseClient
      .from("pending_workouts")
      .insert({
        id: pendingWorkoutId,
        generation_attempt_id: trace.id,
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
      throw new Error(
        `Failed to create placeholder: ${placeholderError?.message ?? "No row returned"}`
      );
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
      recentComments: recentComments.length > 0 ? recentComments : undefined,
      loggingClient: supabaseClient,
      pendingWorkoutId: placeholder.id,
      functionName: "generate-next-workout",
      trace,
      deadlineAt,
    });

    if (!genResult.success || !genResult.data) {
      console.error(
        `[generate-next-workout] Generation failed: ${genResult.error}`
      );

      throw new Error(genResult.error ?? "Workout generation failed");
    }

    await trace.stage("persistence");
    // 11. Update placeholder with generated data
    const { data: completed, error: insertError } = await supabaseClient.rpc(
      "complete_pending_workout_attempt",
      {
        p_attempt_id: trace.id,
        p_user_id: user_id,
        p_pending_workout_id: placeholder.id,
        p_workout_data: genResult.data,
        p_generation_source: genResult.generationSource,
        p_final_output: genResult.data,
        p_fallback_reason: genResult.fallbackReason ?? null,
      }
    );
    if (!insertError && !completed)
      throw new Error(
        "Generation attempt expired or was replaced before saving"
      );

    if (insertError) {
      console.error(
        "[generate-next-workout] Error inserting replacement:",
        insertError
      );
      throw new Error(
        `Failed to save replacement workout: ${insertError.message}`
      );
    }

    saved = true;
    await trace.finish(
      genResult.generationSource === "llm"
        ? "succeeded"
        : "succeeded_with_fallback",
      {
        generation_source: genResult.generationSource,
        fallback_reason: genResult.fallbackReason,
        final_output: genResult.data,
      }
    );
    console.log(
      `[generate-next-workout] Replacement generated: user ${user_id}, position ${targetPosition}, focus ${focusArea}`
    );

    await recordGenerationUsage(supabaseClient, user_id, "auto_completion", 1);

    return jsonResponse({
      success: true,
      request_id: trace.requestId,
      queue_position: targetPosition,
      focus_area: focusArea,
      generation_source: genResult.generationSource,
    });
  } catch (err) {
    console.error("[generate-next-workout] Unhandled error:", err);
    await trace?.finish("failed", {
      error_code: "generation_failed",
      error_message: err instanceof Error ? err.message : String(err),
    });
    return jsonResponse(
      { error: "Workout generation failed", request_id: trace?.requestId },
      500
    );
  } finally {
    if (!saved && recoveryClient && trace) {
      // Only this attempt may restore its placeholder. Never overwrite a newer attempt.
      const { error } = await recoveryClient
        .from("pending_workouts")
        .update({ status: "failed" })
        .eq("id", pendingWorkoutId)
        .eq("generation_attempt_id", trace.id)
        .eq("status", "generating");
      if (error)
        console.error(
          JSON.stringify({
            event: "generation_recovery_failed",
            request_id: trace.requestId,
            attempt_id: trace.id,
            error: error.message,
          })
        );
    }
  }
});
