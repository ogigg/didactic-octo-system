import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
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

type ServiceClient = SupabaseClient<any, "public", any>;

// ---------------------------------------------------------------------------
// Request Schema
// ---------------------------------------------------------------------------

const requestSchema = z.object({
  request_id: z.string().uuid().optional(),
  count: z.number().int().min(1).max(7),
  trigger: z.enum(["onboarding", "preference_change"]),
});

function getTargetQueueCount(weeklyFrequency: string | null): number {
  switch (weeklyFrequency) {
    case "2":
      return 2;
    case "3":
      return 3;
    case "4":
      return 4;
    case "5_plus":
      return 5;
    default:
      return 3;
  }
}

interface GeneratedQueueRow {
  id: string;
  queue_position: number;
  status: "ready";
  focus_area: string | null;
  workout_data: Record<string, unknown>;
  generation_source: "llm" | "fallback_template" | "fallback_substitution";
  generated_at: string;
}

async function claimQueueGeneration(
  supabaseClient: ServiceClient,
  userId: string,
  requestId: string,
  trigger: "onboarding" | "preference_change"
): Promise<"claimed" | "in_progress" | "already_ready"> {
  const { data, error } = await supabaseClient.rpc("claim_queue_generation", {
    p_user_id: userId,
    p_request_id: requestId,
    p_trigger: trigger,
  });

  if (error) throw error;

  const result = (Array.isArray(data) ? data[0] : data) as {
    status?: "claimed" | "in_progress" | "already_ready";
  } | null;
  if (
    result?.status !== "claimed" &&
    result?.status !== "in_progress" &&
    result?.status !== "already_ready"
  ) {
    throw new Error("Invalid queue generation claim response");
  }

  return result.status;
}

async function releaseQueueGeneration(
  supabaseClient: ServiceClient,
  userId: string,
  requestId: string
): Promise<void> {
  const { error } = await supabaseClient.rpc("release_queue_generation", {
    p_user_id: userId,
    p_request_id: requestId,
  });

  if (error) {
    console.error("[generate-workout-queue] Failed to release claim:", error);
  }
}

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
  let queueClaimed = false;
  let queueClaimClient: ServiceClient | null = null;

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
    const { count: requestedCount, trigger, request_id } = parsed.data;
    const requestId = request_id ?? crypto.randomUUID();
    const queueStartedAt = Date.now();
    requestIdForTelemetry = requestId;
    queueStartedAtForTelemetry = queueStartedAt;

    console.log(
      `[generate-workout-queue] User ${user.id}: generating up to ${requestedCount} workouts (${trigger})`
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
        count: requestedCount,
        ready_count: 0,
        failed_count: requestedCount,
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

    // 7. The server owns the queue size; the client cannot request more than
    // the user's saved weekly frequency.
    const count =
      trigger === "onboarding"
        ? getTargetQueueCount(profile.weekly_frequency)
        : Math.min(
            requestedCount,
            getTargetQueueCount(profile.weekly_frequency)
          );

    // 8. Claim the profile before any slow generation work. The old queue
    // remains visible until a complete replacement is committed.
    const claimStatus = await claimQueueGeneration(
      supabaseClient,
      user.id,
      requestId,
      trigger
    );

    if (claimStatus === "already_ready") {
      return jsonResponse({
        success: true,
        skipped: true,
        reason: "initial_queue_already_ready",
        request_id: requestId,
      });
    }

    if (claimStatus === "in_progress") {
      captureQueueFailureEvent({
        userId: user.id,
        requestId,
        stage: "validation",
        error: "generation already in progress",
        startedAt: queueStartedAt,
        trigger,
      });
      return jsonResponse(
        {
          error: "generation_already_in_progress",
          skipped: true,
          request_id: requestId,
        },
        409
      );
    }

    queueClaimed = true;
    queueClaimClient = supabaseClient;

    // 9. Check allowance after the claim so concurrent requests cannot both
    // pass a stale allowance read.
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

    // 10. Generate each workout in memory. No pending rows are touched until
    // every requested workout is ready for the atomic replacement RPC.
    const generatedRows: GeneratedQueueRow[] = [];
    const insertedWorkouts = Array.from({ length: count }, (_, i) => ({
      id: crypto.randomUUID(),
      queue_position: i + 1,
      focus_area: getFocusAreaForPosition(profile.training_split, i + 1),
    }));

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
        const generatedAt = new Date().toISOString();
        const generationSource = genResult.generationSource ?? "llm";
        generatedRows.push({
          id: pw.id,
          queue_position: pw.queue_position,
          status: "ready",
          focus_area: pw.focus_area,
          workout_data: genResult.data as unknown as Record<string, unknown>,
          generation_source: generationSource,
          generated_at: generatedAt,
        });

        capturePostHogEvent("workout_generation_completed", user.id, {
          request_id: requestId,
          workout_id: pw.id,
          queue_position: pw.queue_position,
          generation_source: generationSource,
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
          source: generationSource,
        });
      } else {
        console.error(
          `[generate-workout-queue] Failed position ${pw.queue_position}: ${genResult.error}`
        );

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
        break;
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
    if (failedCount > 0 || successfulCount !== count) {
      capturePostHogEvent("workout_queue_failed", user.id, {
        request_id: requestId,
        trigger,
        count,
        ready_count: successfulCount,
        failed_count: failedCount,
        error_code: failedCount > 0 ? "generation_failed" : "internal",
      });

      return jsonResponse(
        {
          error: "generation_failed",
          count,
          trigger,
          results,
        },
        500
      );
    }

    const { error: replaceError } = await supabaseClient.rpc(
      "replace_pending_workouts",
      {
        p_user_id: user.id,
        p_request_id: requestId,
        p_trigger: trigger,
        p_workouts: generatedRows,
      }
    );

    if (replaceError) {
      captureQueueFailureEvent({
        userId: user.id,
        requestId,
        stage: "persistence",
        error: replaceError,
        startedAt: queueStartedAt,
        trigger,
      });
      capturePostHogEvent("workout_queue_failed", user.id, {
        request_id: requestId,
        trigger,
        count,
        ready_count: 0,
        failed_count: count,
        error_code: "queue_replace_failed",
      });
      return errorResponse("Failed to save workout queue", 500);
    }

    capturePostHogEvent("workout_queue_ready", user.id, {
      request_id: requestId,
      trigger,
      count,
      fallback_count: fallbackCount,
      total_generation_time_ms: Math.max(0, Date.now() - queueStartedAt),
    });

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
  } finally {
    if (
      queueClaimed &&
      queueClaimClient &&
      userIdForTelemetry &&
      requestIdForTelemetry
    ) {
      await releaseQueueGeneration(
        queueClaimClient,
        userIdForTelemetry,
        requestIdForTelemetry
      );
    }
  }
});
