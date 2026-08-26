import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import {
  type ExercisePreference,
  generateSingleWorkout,
  getFocusAreaForPosition,
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
import {
  capturePostHogEvent,
  normalizeGenerationFailure,
} from "../_shared/posthog.ts";

// ---------------------------------------------------------------------------
// Request Schema
// ---------------------------------------------------------------------------

const requestSchema = z.object({
  request_id: z.string().uuid().optional(),
  count: z.number().int().min(1).max(7),
  trigger: z.enum(["onboarding", "preference_change"]),
});

function captureQueueFailureEvent(params: {
  userId: string;
  requestId: string;
  stage: Parameters<typeof normalizeGenerationFailure>[0];
  error: unknown;
  startedAt: number;
  trigger: string;
  queuePosition?: number;
  workoutId?: string;
}): void {
  const failure = normalizeGenerationFailure(params.stage, params.error);
  capturePostHogEvent("workout_generation_failed", params.userId, {
    request_id: params.requestId,
    workout_id: params.workoutId,
    queue_position: params.queuePosition,
    trigger: params.trigger,
    generation_time_ms: Math.max(0, Date.now() - params.startedAt),
    ...failure,
  });
}

// ---------------------------------------------------------------------------
// Main Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  console.log("[generate-workout-queue] Request received");

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  let userIdForTelemetry: string | null = null;
  let requestIdForTelemetry: string | null = null;
  let queueStartedAtForTelemetry: number | null = null;

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
    userIdForTelemetry = user.id;

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // 2. Parse request
    const body = await req.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        `Invalid request: ${parsed.error.issues
          .map((i) => i.message)
          .join(", ")}`,
        400
      );
    }
    const { count, trigger, request_id } = parsed.data;
    const requestId = request_id ?? crypto.randomUUID();
    const queueStartedAt = Date.now();
    requestIdForTelemetry = requestId;
    queueStartedAtForTelemetry = queueStartedAt;

    console.log(
      `[generate-workout-queue] User ${user.id}: generating ${count} workouts (${trigger})`
    );

    // 3. Fetch profile with preferences
    const { data: profile, error: profileError } = await userClient
      .from("profiles")
      .select(
        "goal, custom_goal, weekly_frequency, gender, training_split, session_duration_minutes, equipment_level, training_style, difficulty_level, training_custom_prompt"
      )
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      captureQueueFailureEvent({
        userId: user.id,
        requestId,
        stage: "profile",
        error: profileError,
        startedAt: queueStartedAt,
        trigger,
      });
      capturePostHogEvent("workout_queue_failed", user.id, {
        request_id: requestId,
        trigger,
        count,
        ready_count: 0,
        failed_count: count,
        error_code: "profile_missing",
      });
      return errorResponse(
        "Profile not found. Complete onboarding first.",
        400
      );
    }

    if (
      !profile.training_split ||
      !profile.equipment_level ||
      !profile.training_style ||
      !profile.difficulty_level
    ) {
      captureQueueFailureEvent({
        userId: user.id,
        requestId,
        stage: "validation",
        error: "training preferences not set",
        startedAt: queueStartedAt,
        trigger,
      });
      return errorResponse(
        "Training preferences not set. Complete training setup first.",
        400
      );
    }

    const profileGoal = profile.goal ?? "improve_fitness";

    // 4. Fetch strength baselines
    const { data: baselines } = await userClient
      .from("strength_baselines")
      .select("exercise_key, load_kg, reps")
      .eq("user_id", user.id);

    const strengthBaselines: StrengthBaseline[] =
      (baselines as StrengthBaseline[] | null) ?? [];

    // 5. Fetch recent workout history
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

    // 6. Fetch exercise preferences
    const { data: prefRows } = await userClient
      .from("exercise_preferences")
      .select("exercise_id, preference")
      .eq("user_id", user.id);

    const exercisePreferences: ExercisePreference[] =
      (prefRows as ExercisePreference[] | null) ?? [];

    // 6b. Fetch last 3 session comments
    const { data: commentRows } = await userClient
      .from("workout_session_comments")
      .select("comment, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3);

    const recentComments: RecentSessionComment[] =
      (commentRows as RecentSessionComment[] | null) ?? [];

    // 7. Generation allowance check (skip for onboarding — free pass)
    if (trigger === "preference_change") {
      const allowance = await checkGenerationAllowance(
        supabaseClient,
        user.id,
        count
      );

      if (!allowance.allowed) {
        console.log(
          `[generate-workout-queue] Limit reached for user ${user.id}: ${allowance.used}/5 used`
        );
        captureQueueFailureEvent({
          userId: user.id,
          requestId,
          stage: "allowance",
          error: "generation_limit_reached",
          startedAt: queueStartedAt,
          trigger,
        });
        capturePostHogEvent("workout_queue_failed", user.id, {
          request_id: requestId,
          trigger,
          count,
          ready_count: 0,
          failed_count: count,
          error_code: "rate_limited",
        });
        return jsonResponse(
          {
            error: "generation_limit_reached",
            used: allowance.used,
            remaining: allowance.remaining,
            tier: allowance.tier,
          },
          403
        );
      }
    }

    // 8. Check for concurrent generation — skip if already in progress
    const { data: existingQueue } = await userClient
      .from("pending_workouts")
      .select("id, status")
      .eq("user_id", user.id);

    const hasInFlightGeneration = (existingQueue ?? []).some(
      (pw) => pw.status === "queued" || pw.status === "generating"
    );

    if (hasInFlightGeneration) {
      console.log(
        "[generate-workout-queue] Generation already in progress, skipping"
      );
      captureQueueFailureEvent({
        userId: user.id,
        requestId,
        stage: "validation",
        error: "generation already in progress",
        startedAt: queueStartedAt,
        trigger,
      });
      return jsonResponse({
        skipped: true,
        reason: "generation_already_in_progress",
      });
    }

    // 9. Clear existing pending workouts for this user
    const { error: deleteError } = await userClient
      .from("pending_workouts")
      .delete()
      .eq("user_id", user.id);

    if (deleteError) {
      console.error(
        "[generate-workout-queue] Error clearing queue:",
        deleteError
      );
      captureQueueFailureEvent({
        userId: user.id,
        requestId,
        stage: "persistence",
        error: deleteError,
        startedAt: queueStartedAt,
        trigger,
      });
      return errorResponse("Failed to clear existing queue", 500);
    }

    // 10. Create N pending_workout rows with status 'queued'
    const queuedWorkouts = Array.from({ length: count }, (_, i) => ({
      user_id: user.id,
      queue_position: i + 1,
      status: "queued",
      focus_area: getFocusAreaForPosition(profile.training_split, i + 1),
    }));

    const { data: insertedWorkouts, error: insertError } = await userClient
      .from("pending_workouts")
      .insert(queuedWorkouts)
      .select("id, queue_position, focus_area");

    if (insertError || !insertedWorkouts) {
      console.error(
        "[generate-workout-queue] Error creating queue:",
        insertError
      );
      captureQueueFailureEvent({
        userId: user.id,
        requestId,
        stage: "persistence",
        error: insertError,
        startedAt: queueStartedAt,
        trigger,
      });
      return errorResponse("Failed to create workout queue", 500);
    }

    // 11. Generate each workout sequentially
    const results: {
      position: number;
      status: string;
      source?: string;
      error?: string;
    }[] = [];
    const queueContext: QueueContextItem[] = [];

    for (const pw of insertedWorkouts) {
      const generationStartedAt = Date.now();
      console.log(
        `[generate-workout-queue] Generating ${pw.queue_position}/${count} (focus: ${pw.focus_area})`
      );

      capturePostHogEvent("workout_generation_started", user.id, {
        request_id: requestId,
        workout_id: pw.id,
        queue_position: pw.queue_position,
        trigger,
      });

      // Set status to 'generating'
      const { error: markGeneratingError } = await userClient
        .from("pending_workouts")
        .update({ status: "generating" })
        .eq("id", pw.id);

      if (markGeneratingError) {
        captureQueueFailureEvent({
          userId: user.id,
          requestId,
          stage: "persistence",
          error: markGeneratingError,
          startedAt: generationStartedAt,
          trigger,
          queuePosition: pw.queue_position,
          workoutId: pw.id,
        });
        await userClient
          .from("pending_workouts")
          .update({ status: "failed" })
          .eq("id", pw.id);
        results.push({
          position: pw.queue_position,
          status: "failed",
        });
        continue;
      }

      // Generate
      const genResult = await generateSingleWorkout({
        supabaseClient: userClient,
        userId: user.id,
        profile: { ...profile, goal: profileGoal } as ProfileData,
        trainingSplit: profile.training_split,
        durationMinutes: profile.session_duration_minutes ?? 45,
        equipment: profile.equipment_level,
        trainingStyle: profile.training_style,
        difficulty: profile.difficulty_level,
        customPrompt: profile.training_custom_prompt ?? undefined,
        focusArea: pw.focus_area ?? undefined,
        strengthBaselines,
        queueContext: queueContext.length > 0 ? queueContext : undefined,
        history,
        exercisePreferences:
          exercisePreferences.length > 0 ? exercisePreferences : undefined,
        recentComments: recentComments.length > 0 ? recentComments : undefined,
      });

      if (genResult.success && genResult.data) {
        const { error: readyError } = await userClient
          .from("pending_workouts")
          .update({
            workout_data: genResult.data as unknown as Record<string, unknown>,
            generation_source: genResult.generationSource,
            status: "ready",
            generated_at: new Date().toISOString(),
          })
          .eq("id", pw.id);

        if (readyError) {
          captureQueueFailureEvent({
            userId: user.id,
            requestId,
            stage: "persistence",
            error: readyError,
            startedAt: generationStartedAt,
            trigger,
            queuePosition: pw.queue_position,
            workoutId: pw.id,
          });
          await userClient
            .from("pending_workouts")
            .update({ status: "failed" })
            .eq("id", pw.id);
          results.push({
            position: pw.queue_position,
            status: "failed",
          });
          continue;
        }

        capturePostHogEvent("workout_generation_completed", user.id, {
          request_id: requestId,
          workout_id: pw.id,
          queue_position: pw.queue_position,
          generation_source: genResult.generationSource,
          generation_time_ms: Math.max(0, Date.now() - generationStartedAt),
          trigger,
        });

        // Add to queue context for variety in subsequent generations
        queueContext.push({
          queue_position: pw.queue_position,
          focus_area: pw.focus_area,
          workout_data: {
            workout_name: genResult.data.workout_name,
            exercises: genResult.data.exercises.map((ex) => ({
              exercise_name: ex.exercise_name,
              sets: ex.sets.map((s) => ({
                target_load_kg: s.target_load_kg,
                target_reps: s.target_reps,
              })),
            })),
          },
        });

        results.push({
          position: pw.queue_position,
          status: "ready",
          source: genResult.generationSource,
        });
      } else {
        console.error(
          `[generate-workout-queue] Failed position ${pw.queue_position}: ${genResult.error}`
        );

        await userClient
          .from("pending_workouts")
          .update({ status: "failed" })
          .eq("id", pw.id);

        captureQueueFailureEvent({
          userId: user.id,
          requestId,
          stage: "generation",
          error: genResult.error,
          startedAt: generationStartedAt,
          trigger,
          queuePosition: pw.queue_position,
          workoutId: pw.id,
        });

        results.push({
          position: pw.queue_position,
          status: "failed",
          error: genResult.error,
        });
      }
    }

    console.log(
      `[generate-workout-queue] Complete for user ${user.id}:`,
      results
    );

    // Record usage for non-onboarding triggers
    const successfulCount = results.filter((r) => r.status === "ready").length;
    const failedCount = results.filter((r) => r.status === "failed").length;
    const fallbackCount = results.filter(
      (r) => r.status === "ready" && r.source !== "llm"
    ).length;
    if (failedCount === 0 && successfulCount === count) {
      capturePostHogEvent("workout_queue_ready", user.id, {
        request_id: requestId,
        trigger,
        count,
        fallback_count: fallbackCount,
        total_generation_time_ms: Math.max(0, Date.now() - queueStartedAt),
      });
    } else {
      capturePostHogEvent("workout_queue_failed", user.id, {
        request_id: requestId,
        trigger,
        count,
        ready_count: successfulCount,
        failed_count: failedCount,
        error_code: failedCount > 0 ? "generation_failed" : "internal",
      });
    }

    if (trigger !== "onboarding") {
      if (successfulCount > 0) {
        await recordGenerationUsage(
          supabaseClient,
          user.id,
          "preference_change",
          successfulCount
        );
      }
    }

    return jsonResponse({ success: true, count, trigger, results });
  } catch (err) {
    console.error("[generate-workout-queue] Unhandled error:", err);
    if (
      userIdForTelemetry &&
      requestIdForTelemetry &&
      queueStartedAtForTelemetry
    ) {
      captureQueueFailureEvent({
        userId: userIdForTelemetry,
        requestId: requestIdForTelemetry,
        stage: "handler",
        error: err,
        startedAt: queueStartedAtForTelemetry,
        trigger: "unknown",
      });
      capturePostHogEvent("workout_queue_failed", userIdForTelemetry, {
        request_id: requestIdForTelemetry,
        error_code: "internal",
      });
    }
    return errorResponse("Internal server error", 500);
  }
});
