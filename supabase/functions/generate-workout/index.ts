import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
  GENERATION_BUDGET_MS,
  type ExercisePreference,
  generateSingleWorkout,
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
import {
  createGenerationTrace,
  generationFetch,
  type GenerationTrace,
} from "../_shared/generation-trace.ts";

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const RATE_LIMIT_SECONDS = 30;

// -----------------------------------------------------------------------------
// Request Schema
// -----------------------------------------------------------------------------

const requestSchema = z.object({
  request_id: z.string().uuid().optional(),
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
  regeneration_feedback: z.string().trim().min(1).max(300).optional(),
  // Regeneration: identifies a pending workout slot to replace
  pending_workout_id: z.string().uuid().optional(),
  timezone_offset_minutes: z.number().int().min(-840).max(840).optional(),
});

interface PendingWorkoutSnapshot {
  id: string;
  queue_position: number | null;
  regeneration_count: number | null;
  regeneration_feedback: Record<string, unknown>[] | null;
  last_regenerated_at: string | null;
  workout_data: Record<string, unknown> | null;
  status: string;
}

function captureGenerationFailureEvent(params: {
  userId: string;
  requestId: string;
  stage: Parameters<typeof normalizeGenerationFailure>[0];
  error: unknown;
  startedAt: number;
  workoutId?: string;
  queuePosition?: number | null;
  trigger: string;
}): void {
  const failure = normalizeGenerationFailure(params.stage, params.error);
  capturePostHogEvent("workout_generation_failed", params.userId, {
    request_id: params.requestId,
    workout_id: params.workoutId,
    queue_position: params.queuePosition ?? undefined,
    trigger: params.trigger,
    generation_time_ms: Math.max(0, Date.now() - params.startedAt),
    ...failure,
  });
}

function generationErrorResponse(params: {
  requestId: string;
  status: number;
  errorCode: string;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}): Response {
  return jsonResponse(
    {
      error: params.errorCode,
      error_code: params.errorCode,
      message: params.message,
      request_id: params.requestId,
      retryable: params.retryable,
      ...params.details,
    },
    params.status
  );
}

function toDateKeyForOffset(date: Date, timezoneOffsetMinutes: number): string {
  const shifted = new Date(date.getTime() - timezoneOffsetMinutes * 60_000);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// -----------------------------------------------------------------------------
// Main Handler
// -----------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  const deadlineAt = Date.now() + GENERATION_BUDGET_MS;
  console.log("[generate-workout] Request received", {
    method: req.method,
    url: req.url,
  });

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  let pendingWorkoutSnapshot: PendingWorkoutSnapshot | null = null;
  let pendingWorkoutIdForRecovery: string | null = null;
  let userIdForRecovery: string | null = null;
  let requestIdForTelemetry: string | null = null;
  let generationStartedAtForTelemetry: number | null = null;
  let generationTrace: GenerationTrace | null = null;

  try {
    // 1. Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader)
      return generationErrorResponse({
        requestId: crypto.randomUUID(),
        status: 401,
        errorCode: "unauthorized",
        message: "Missing authorization header",
        retryable: false,
      });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false }, global: { fetch: generationFetch } }
    );

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(token);

    if (authError || !user)
      return generationErrorResponse({
        requestId: crypto.randomUUID(),
        status: 401,
        errorCode: "unauthorized",
        message: "Unauthorized",
        retryable: false,
      });

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
          fetch: generationFetch,
        },
      }
    );
    userIdForRecovery = user.id;

    // 2. Parse and validate request
    const body = await req.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      const requestIdHint =
        typeof body?.request_id === "string" &&
        z.string().uuid().safeParse(body.request_id).success
          ? body.request_id
          : crypto.randomUUID();
      return generationErrorResponse({
        requestId: requestIdHint,
        status: 400,
        errorCode: "invalid_request",
        message: `Invalid request: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
        retryable: false,
      });
    }

    const {
      request_id,
      training_split,
      duration_minutes,
      equipment,
      training_style,
      difficulty,
      custom_prompt,
      regeneration_feedback,
      pending_workout_id,
      timezone_offset_minutes,
    } = parsed.data;
    const requestId = request_id ?? crypto.randomUUID();
    const generationStartedAt = Date.now();
    requestIdForTelemetry = requestId;
    generationStartedAtForTelemetry = generationStartedAt;
    const generationTrigger = pending_workout_id ? "regeneration" : "immediate";
    let queuePositionForTelemetry: number | null = null;
    capturePostHogEvent("workout_generation_started", user.id, {
      request_id: requestId,
      workout_id: pending_workout_id,
      trigger: generationTrigger,
    });
    pendingWorkoutIdForRecovery = pending_workout_id ?? null;

    const { error: recoveryError } = await supabaseClient.rpc(
      "recover_stale_generation_attempts",
      { p_user_id: user.id }
    );
    if (recoveryError)
      throw new Error(`generation recovery failed: ${recoveryError.message}`);

    generationTrace = await createGenerationTrace(supabaseClient, {
      deadlineAt,
      requestId,
      userId: user.id,
      pendingWorkoutId: pending_workout_id,
      functionName: "generate-workout",
      trigger: generationTrigger,
    });
    await generationTrace.stage("authentication", { user_id: user.id });

    if (
      generationTrace.claimStatus === "in_progress" ||
      generationTrace.claimStatus === "rejected"
    ) {
      return generationErrorResponse({
        requestId,
        status: 409,
        errorCode: "generation_in_progress",
        message: "A generation is already in progress for this workout.",
        retryable: true,
        details: { attempt_id: generationTrace.id },
      });
    }
    if (generationTrace.claimStatus === "already_finished") {
      const { data: previousAttempt, error: previousAttemptError } =
        await supabaseClient
          .from("generation_attempts")
          .select("status, final_output, error_code, error_message")
          .eq("id", generationTrace.id)
          .eq("user_id", user.id)
          .single();
      if (
        !previousAttemptError &&
        previousAttempt?.status?.startsWith("succeeded") &&
        previousAttempt.final_output
      ) {
        return jsonResponse(previousAttempt.final_output);
      }
      return generationErrorResponse({
        requestId,
        status: 409,
        errorCode:
          previousAttempt?.error_code ?? "generation_already_completed",
        message:
          previousAttempt?.error_message ??
          "Generation request has already completed.",
        retryable: false,
        details: { attempt_id: generationTrace.id },
      });
    }

    if (pending_workout_id) {
      const { data: claimedPendingWorkout, error: claimedPendingError } =
        await userClient
          .from("pending_workouts")
          .select(
            "id, queue_position, regeneration_count, regeneration_feedback, last_regenerated_at, workout_data, status"
          )
          .eq("id", pending_workout_id)
          .eq("user_id", user.id)
          .single();
      if (claimedPendingError || !claimedPendingWorkout) {
        await generationTrace.finish("failed", {
          error_code: "pending_workout_missing",
          error_message:
            claimedPendingError?.message ?? "Pending workout not found",
        });
        return generationErrorResponse({
          requestId,
          status: 404,
          errorCode: "pending_workout_missing",
          message: "Pending workout not found",
          retryable: false,
        });
      }
      pendingWorkoutSnapshot = claimedPendingWorkout;
      queuePositionForTelemetry = claimedPendingWorkout.queue_position;
    }

    // 3. Generation allowance check (pending workout regeneration only — not used for direct generation)
    await generationTrace.stage("allowance");
    if (pending_workout_id) {
      const allowance = await checkGenerationAllowance(
        supabaseClient,
        user.id,
        1
      );

      if (!allowance.allowed) {
        console.log(
          `[generate-workout] Limit reached for user ${user.id}: ${allowance.used}/5 used`
        );
        captureGenerationFailureEvent({
          userId: user.id,
          requestId,
          stage: "allowance",
          error: "generation_limit_reached",
          startedAt: generationStartedAt,
          workoutId: pending_workout_id,
          trigger: generationTrigger,
        });
        await generationTrace.finish("rejected", {
          error_code: "generation_limit_reached",
          error_message: "Generation allowance exhausted",
        });
        return generationErrorResponse({
          requestId,
          status: 403,
          errorCode: "generation_limit_reached",
          message: "Generation allowance exhausted",
          retryable: false,
          details: {
            used: allowance.used,
            remaining: allowance.remaining,
            tier: allowance.tier,
          },
        });
      }
    }

    // 4. Rate limiting (skip for pending workout regeneration — has its own daily limit)
    await generationTrace.stage("rate_limit");
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
          captureGenerationFailureEvent({
            userId: user.id,
            requestId,
            stage: "rate_limit",
            error: "rate limited",
            startedAt: generationStartedAt,
            trigger: generationTrigger,
          });
          await generationTrace.finish("rejected", {
            error_code: "rate_limited",
            error_message: "Generation rate limit reached",
          });
          return generationErrorResponse({
            requestId,
            status: 429,
            errorCode: "rate_limited",
            message: "Rate limited",
            retryable: true,
            details: { retry_after: Math.ceil(RATE_LIMIT_SECONDS - elapsed) },
          });
        }
      }
    }

    // 5. Daily regeneration limit for pending workouts
    if (pending_workout_id) {
      await generationTrace.stage("validation", { target: "pending_workout" });
      if (pendingWorkoutSnapshot?.last_regenerated_at) {
        const currentTimezoneOffsetMinutes = timezone_offset_minutes ?? 0;
        const sameDay =
          toDateKeyForOffset(
            new Date(pendingWorkoutSnapshot.last_regenerated_at),
            currentTimezoneOffsetMinutes
          ) === toDateKeyForOffset(new Date(), currentTimezoneOffsetMinutes);

        if (sameDay) {
          captureGenerationFailureEvent({
            userId: user.id,
            requestId,
            stage: "allowance",
            error: "rate limited",
            startedAt: generationStartedAt,
            workoutId: pending_workout_id,
            queuePosition: pendingWorkoutSnapshot.queue_position,
            trigger: generationTrigger,
          });
          await generationTrace.finish("rejected", {
            error_code: "daily_regeneration_limit",
            error_message: "Daily regeneration limit reached",
          });
          return generationErrorResponse({
            requestId,
            status: 429,
            errorCode: "daily_regeneration_limit",
            message:
              "Daily regeneration limit reached. Try again tomorrow or edit the workout instead.",
            retryable: true,
          });
        }
      }
    }

    // 6. Fetch profile
    await generationTrace.stage("context", { source: "profile" });
    const { data: profile, error: profileError } = await userClient
      .from("profiles")
      .select("goal, custom_goal, weekly_frequency, gender")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      captureGenerationFailureEvent({
        userId: user.id,
        requestId,
        stage: "profile",
        error: profileError,
        startedAt: generationStartedAt,
        workoutId: pending_workout_id,
        queuePosition: pendingWorkoutSnapshot?.queue_position,
        trigger: generationTrigger,
      });
      await generationTrace.finish("failed", {
        error_code: "profile_missing",
        error_message: profileError?.message ?? "Profile not found",
      });
      return generationErrorResponse({
        requestId,
        status: 400,
        errorCode: "profile_missing",
        message: "Profile not found. Complete onboarding first.",
        retryable: false,
      });
    }

    const profileGoal: string = profile.goal ?? "improve_fitness";

    // 7–10. These context reads are independent once auth, validation, and
    // the profile are complete. Run them together, then resolve history RPCs
    // in parallel while Promise.all preserves the newest-first order.
    await generationTrace.stage("context", {
      sources: [
        "history",
        "strength_baselines",
        "queue",
        "exercise_preferences",
        "comments",
      ],
      parallel: true,
    });

    const queueContextQuery = pending_workout_id
      ? userClient
          .from("pending_workouts")
          .select("queue_position, focus_area, workout_data")
          .eq("user_id", user.id)
          .neq("id", pending_workout_id)
          .eq("status", "ready")
          .order("queue_position")
      : Promise.resolve({ data: null, error: null });

    const [
      historyResult,
      baselinesResult,
      queueContextResult,
      preferencesResult,
      commentsResult,
    ] = await Promise.all([
      userClient
        .from("workout_sessions")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(4),
      userClient
        .from("strength_baselines")
        .select("exercise_key, load_kg, reps")
        .eq("user_id", user.id),
      queueContextQuery,
      userClient
        .from("exercise_preferences")
        .select("exercise_id, preference")
        .eq("user_id", user.id),
      userClient
        .from("workout_session_comments")
        .select("comment, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(3),
    ]);

    if (historyResult.error)
      throw new Error(`history query failed: ${historyResult.error.message}`);
    if (baselinesResult.error)
      throw new Error(
        `strength baseline query failed: ${baselinesResult.error.message}`
      );
    if (queueContextResult.error)
      throw new Error(
        `queue context query failed: ${queueContextResult.error.message}`
      );
    if (preferencesResult.error)
      throw new Error(
        `exercise preference query failed: ${preferencesResult.error.message}`
      );
    if (commentsResult.error)
      throw new Error(
        `session comments query failed: ${commentsResult.error.message}`
      );

    const historyDetails = await Promise.all(
      (historyResult.data ?? []).map(async (session) => {
        const { data: detail, error: detailError } = await userClient.rpc(
          "get_workout_session_detail",
          { p_session_id: session.id }
        );
        if (detailError)
          throw new Error(`history lookup failed: ${detailError.message}`);
        return detail as HistorySession | null;
      })
    );
    const history: HistorySession[] = historyDetails.filter(
      (detail): detail is HistorySession => detail !== null
    );

    const strengthBaselines: StrengthBaseline[] =
      (baselinesResult.data as StrengthBaseline[] | null) ?? [];

    let queueContext: QueueContextItem[] | undefined;
    if (queueContextResult.data?.length) {
      queueContext = queueContextResult.data.map((pw) => ({
        queue_position: pw.queue_position,
        focus_area: pw.focus_area,
        workout_data: pw.workout_data as QueueContextItem["workout_data"],
      }));
    }

    const exercisePreferences: ExercisePreference[] =
      (preferencesResult.data as ExercisePreference[] | null) ?? [];
    const recentComments: RecentSessionComment[] =
      (commentsResult.data as RecentSessionComment[] | null) ?? [];

    // 11. Generate workout
    await generationTrace.stage("generation");
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
      regenerationFeedback: regeneration_feedback,
      strengthBaselines:
        strengthBaselines.length > 0 ? strengthBaselines : undefined,
      queueContext,
      history,
      exercisePreferences:
        exercisePreferences.length > 0 ? exercisePreferences : undefined,
      recentComments: recentComments.length > 0 ? recentComments : undefined,
      loggingClient: supabaseClient,
      trace: generationTrace!,
      pendingWorkoutId: pending_workout_id ?? null,
      functionName: "generate-workout",
      deadlineAt,
    });

    if (!result.success || !result.data) {
      captureGenerationFailureEvent({
        userId: user.id,
        requestId,
        stage: "generation",
        error: result.error,
        startedAt: generationStartedAt,
        workoutId: pending_workout_id,
        queuePosition: pendingWorkoutSnapshot?.queue_position,
        trigger: generationTrigger,
      });
      await generationTrace.finish("failed", {
        error_code: "generation_failed",
        error_message: result.error ?? "Workout generation failed",
      });

      return generationErrorResponse({
        requestId,
        status: 500,
        errorCode: "generation_failed",
        message: result.error ?? "Workout generation failed",
        retryable: true,
      });
    }

    // 12. If regenerating a pending workout, update it
    if (pending_workout_id) {
      await generationTrace.stage("persistence", { target: "pending_workout" });
      const submittedAt = new Date().toISOString();
      const previousFeedback =
        pendingWorkoutSnapshot?.regeneration_feedback ?? [];
      const regenerationFeedbackEntry = {
        feedback: regeneration_feedback ?? null,
        has_feedback: !!regeneration_feedback,
        submitted_at: submittedAt,
      };
      const generationResult = result as typeof result & {
        fallbackReason?: string;
      };
      const { data: committed, error: updateError } = await supabaseClient.rpc(
        "complete_regeneration_attempt",
        {
          p_attempt_id: generationTrace.id,
          p_user_id: user.id,
          p_pending_workout_id: pending_workout_id,
          p_workout_data: result.data,
          p_generation_source: result.generationSource,
          p_regeneration_count:
            (pendingWorkoutSnapshot?.regeneration_count ?? 0) + 1,
          p_regeneration_feedback: [
            ...previousFeedback,
            regenerationFeedbackEntry,
          ],
          p_last_regenerated_at: submittedAt,
          p_final_output: result.data,
          p_fallback_reason: generationResult.fallbackReason ?? null,
        }
      );

      if (updateError || committed !== true) {
        await generationTrace.finish("failed", {
          error_code: updateError
            ? "persistence_failed"
            : "generation_claim_lost",
          error_message:
            updateError?.message ?? "Generation claim is no longer valid",
        });

        captureGenerationFailureEvent({
          userId: user.id,
          requestId,
          stage: "persistence",
          error: updateError ?? "generation claim is no longer valid",
          startedAt: generationStartedAt,
          workoutId: pending_workout_id,
          queuePosition: pendingWorkoutSnapshot?.queue_position,
          trigger: generationTrigger,
        });

        return generationErrorResponse({
          requestId,
          status: updateError ? 500 : 409,
          errorCode: updateError
            ? "persistence_failed"
            : "generation_claim_lost",
          message: updateError
            ? "Failed to save regenerated workout."
            : "Generation claim expired.",
          retryable: true,
        });
      }

      pendingWorkoutSnapshot = null;
    }

    console.log("[generate-workout] Success!", {
      generationSource: result.generationSource,
      exerciseCount: result.data.exercises.length,
      pendingWorkoutRegenerated: !!pending_workout_id,
    });

    const generationResult = result as typeof result & {
      fallbackReason?: string;
    };
    await generationTrace.finish(
      result.generationSource === "llm"
        ? "succeeded"
        : "succeeded_with_fallback",
      {
        generation_source: result.generationSource,
        fallback_reason: generationResult.fallbackReason,
        final_output: result.data,
      }
    );

    // Record usage for pending workout regeneration
    if (pending_workout_id) {
      await recordGenerationUsage(supabaseClient, user.id, "regeneration", 1);
    }

    capturePostHogEvent("workout_generation_completed", user.id, {
      request_id: requestId,
      workout_id: pending_workout_id,
      queue_position: queuePositionForTelemetry ?? undefined,
      generation_source: result.generationSource,
      generation_time_ms: Math.max(0, Date.now() - generationStartedAt),
      trigger: generationTrigger,
    });

    return jsonResponse(result.data);
  } catch (err) {
    if (generationTrace && generationTrace.claimStatus === "claimed") {
      await generationTrace.finish("failed", {
        error_code: "handler_error",
        error_message: err instanceof Error ? err.message : String(err),
      });
    }
    console.error("[generate-workout] Unhandled error:", err);
    if (
      userIdForRecovery &&
      requestIdForTelemetry &&
      generationStartedAtForTelemetry
    ) {
      captureGenerationFailureEvent({
        userId: userIdForRecovery,
        requestId: requestIdForTelemetry,
        stage: "handler",
        error: err,
        startedAt: generationStartedAtForTelemetry,
        workoutId: pendingWorkoutIdForRecovery ?? undefined,
        trigger: pendingWorkoutIdForRecovery ? "regeneration" : "immediate",
      });
    }
    return generationErrorResponse({
      requestId: requestIdForTelemetry ?? crypto.randomUUID(),
      status: 500,
      errorCode: "internal_error",
      message: "Internal server error",
      retryable: true,
    });
  }
});
