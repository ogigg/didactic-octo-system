import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import {
  createGenerationTrace,
  generationFetch,
  type GenerationTrace,
} from "../_shared/generation-trace.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import {
  type ExerciseCatalogEntry,
  type ExercisePreference,
  fetchExerciseCatalog,
  generateSingleWorkout,
  GENERATION_BUDGET_MS,
  getFocusAreaForPosition,
  type HistorySession,
  planQueueCatalogs,
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

const QUEUE_GENERATION_CONCURRENCY = 2;

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
  const handlerStartedAt = Date.now();
  const deadlineAt = handlerStartedAt + GENERATION_BUDGET_MS;
  console.log("[generate-workout-queue] Request received");

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  let userIdForTelemetry: string | null = null;
  let requestIdForTelemetry: string | null = null;
  let queueStartedAtForTelemetry: number | null = null;
  let queueClaimed = false;
  let queueClaimClient: ServiceClient | null = null;
  let trace: GenerationTrace | undefined;
  const workoutTraces: {
    trace: GenerationTrace;
    source?: string;
    fallbackReason?: string;
    output?: unknown;
  }[] = [];
  let queueSaved = false;

  try {
    // 1. Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("Missing authorization header", 401);

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

    if (authError || !user) return errorResponse("Unauthorized", 401);
    userIdForTelemetry = user.id;

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
    const queueStartedAt = handlerStartedAt;
    requestIdForTelemetry = requestId;
    queueStartedAtForTelemetry = queueStartedAt;
    const { error: recoveryError } = await supabaseClient.rpc(
      "recover_stale_generation_attempts",
      { p_user_id: user.id }
    );
    if (recoveryError) throw recoveryError;
    trace = await createGenerationTrace(supabaseClient, {
      deadlineAt,
      requestId,
      userId: user.id,
      functionName: "generate-workout-queue",
      trigger,
    });
    if (trace.claimStatus && trace.claimStatus !== "claimed") {
      const { data: previous } = await supabaseClient
        .from("generation_attempts")
        .select("status")
        .eq("id", trace.id)
        .single();
      const succeeded =
        previous?.status === "succeeded" ||
        previous?.status === "succeeded_with_fallback";
      return jsonResponse(
        {
          skipped: succeeded,
          error: succeeded
            ? undefined
            : "generation_already_in_progress_or_finished",
          request_id: requestId,
        },
        succeeded ? 200 : 409
      );
    }
    await trace.stage("context");

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
      await trace.finish("rejected", {
        error_code: "profile_missing",
        error_message: "Complete onboarding first",
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
      await trace.finish("rejected", {
        error_code: "preferences_missing",
        error_message: "Complete training setup first",
      });
      return errorResponse(
        "Training preferences not set. Complete training setup first.",
        400
      );
    }

    const profileGoal = profile.goal ?? "improve_fitness";

    // 4-6. These reads do not depend on one another; fetch them together.
    const [
      baselinesResult,
      recentSessionsResult,
      preferencesResult,
      commentsResult,
      exerciseCatalog,
    ] = await Promise.all([
      userClient
        .from("strength_baselines")
        .select("exercise_key, load_kg, reps")
        .eq("user_id", user.id),
      userClient
        .from("workout_sessions")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(4),
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
      fetchExerciseCatalog(userClient, profile.equipment_level),
    ]);

    if (baselinesResult.error) {
      throw new Error("baselinesError: " + baselinesResult.error.message);
    }
    if (recentSessionsResult.error) {
      throw new Error("historyError: " + recentSessionsResult.error.message);
    }
    if (preferencesResult.error) {
      throw new Error("preferencesError: " + preferencesResult.error.message);
    }
    if (commentsResult.error) {
      throw new Error("commentsError: " + commentsResult.error.message);
    }

    const strengthBaselines: StrengthBaseline[] =
      (baselinesResult.data as StrengthBaseline[] | null) ?? [];
    const exercisePreferences: ExercisePreference[] =
      (preferencesResult.data as ExercisePreference[] | null) ?? [];
    const recentComments: RecentSessionComment[] =
      (commentsResult.data as RecentSessionComment[] | null) ?? [];

    // Detail RPCs are independent after the session list is known.
    const historyDetails = await Promise.all(
      ((recentSessionsResult.data as { id: string }[] | null) ?? []).map(
        async (session) => {
          const { data: detail, error: detailError } = await userClient.rpc(
            "get_workout_session_detail",
            { p_session_id: session.id }
          );
          if (detailError) {
            throw new Error("history detail: " + detailError.message);
          }
          return detail as HistorySession | null;
        }
      )
    );
    const history = historyDetails.filter(
      (detail): detail is HistorySession => detail != null
    );

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
    await trace.stage("claim");
    const claimStatus = await claimQueueGeneration(
      supabaseClient,
      user.id,
      requestId,
      trigger
    );

    if (claimStatus === "already_ready") {
      await trace.finish("rejected", {
        error_code: "initial_queue_already_ready",
        error_message: "Initial queue is already ready; no generation required",
      });
      return jsonResponse({
        success: true,
        skipped: true,
        reason: "initial_queue_already_ready",
        request_id: requestId,
      });
    }

    if (claimStatus === "in_progress") {
      await trace.finish("rejected", {
        error_code: "generation_already_in_progress",
        error_message: "Another queue request owns the generation claim",
      });
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
    await trace.stage("allowance");
    if (trigger === "preference_change") {
      const allowance = await checkGenerationAllowance(
        supabaseClient,
        user.id,
        count
      );

      if (!allowance.allowed) {
        await trace.finish("rejected", {
          error_code: "generation_limit_reached",
          error_message: "Generation allowance exhausted",
        });
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
    const durationMinutes = profile.session_duration_minutes ?? 45;
    const plannedCatalogs: ExerciseCatalogEntry[][] = planQueueCatalogs(
      exerciseCatalog,
      exercisePreferences,
      insertedWorkouts.map(({ focus_area, queue_position }) => ({
        focus_area,
        queue_position,
      })),
      durationMinutes,
      profile.training_custom_prompt ?? undefined
    );
    const staticQueueContext: QueueContextItem[] = insertedWorkouts.map(
      ({ focus_area, queue_position }) => ({
        queue_position,
        focus_area,
        workout_data: null,
      })
    );
    const completedQueueContext = new Map<number, QueueContextItem>();
    const results: {
      position: number;
      status: string;
      source?: string;
      error?: string;
    }[] = [];

    await trace.stage("generating_queue", {
      workout_count: count,
      concurrency: QUEUE_GENERATION_CONCURRENCY,
      deadline_at: new Date(deadlineAt).toISOString(),
    });

    interface QueueWorkerOutcome {
      result: {
        position: number;
        status: string;
        source?: string;
        error?: string;
      };
      row?: GeneratedQueueRow;
      context?: QueueContextItem;
    }

    for (
      let waveStart = 0;
      waveStart < insertedWorkouts.length;
      waveStart += QUEUE_GENERATION_CONCURRENCY
    ) {
      const wave = insertedWorkouts.slice(
        waveStart,
        waveStart + QUEUE_GENERATION_CONCURRENCY
      );
      const waveContext = staticQueueContext.map(
        (item) => completedQueueContext.get(item.queue_position) ?? item
      );
      const settled = await Promise.allSettled(
        wave.map(async (pw): Promise<QueueWorkerOutcome> => {
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

          const childTrace = await createGenerationTrace(supabaseClient, {
            deadlineAt,
            requestId,
            userId: user.id,
            pendingWorkoutId: pw.id,
            functionName: "generate-workout-queue",
            trigger,
          });
          const tracked: (typeof workoutTraces)[number] = { trace: childTrace };
          workoutTraces.push(tracked);
          const plannedCatalog =
            plannedCatalogs[pw.queue_position - 1] ?? exerciseCatalog;
          await childTrace.stage("queue_slot", {
            queue_position: pw.queue_position,
            focus_area: pw.focus_area,
            candidate_count: plannedCatalog.length,
          });

          const genResult = await generateSingleWorkout({
            supabaseClient: userClient,
            userId: user.id,
            profile: { ...profile, goal: profileGoal } as ProfileData,
            trainingSplit: profile.training_split,
            durationMinutes,
            equipment: profile.equipment_level,
            trainingStyle: profile.training_style,
            difficulty: profile.difficulty_level,
            customPrompt: profile.training_custom_prompt ?? undefined,
            focusArea: pw.focus_area ?? undefined,
            queuePosition: pw.queue_position,
            strengthBaselines,
            queueContext: waveContext,
            history,
            exercisePreferences:
              exercisePreferences.length > 0 ? exercisePreferences : undefined,
            recentComments:
              recentComments.length > 0 ? recentComments : undefined,
            catalog: plannedCatalog,
            deadlineAt,
            loggingClient: supabaseClient,
            pendingWorkoutId: pw.id,
            functionName: "generate-workout-queue",
            trace: childTrace,
          });
          tracked.source = genResult.generationSource;
          tracked.fallbackReason = genResult.fallbackReason;
          tracked.output = genResult.data;

          if (!genResult.success || !genResult.data) {
            await childTrace.finish("failed", {
              error_code: "generation_failed",
              error_message: genResult.error ?? "No workout produced",
            });
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
            return {
              result: {
                position: pw.queue_position,
                status: "failed",
                error: genResult.error,
              },
            };
          }

          await childTrace.stage("awaiting_persistence");
          const generatedAt = new Date().toISOString();
          const generationSource = genResult.generationSource ?? "llm";
          capturePostHogEvent("workout_generation_completed", user.id, {
            request_id: requestId,
            workout_id: pw.id,
            queue_position: pw.queue_position,
            generation_source: generationSource,
            generation_time_ms: Math.max(0, Date.now() - generationStartedAt),
            trigger,
          });

          const context: QueueContextItem = {
            queue_position: pw.queue_position,
            focus_area: pw.focus_area,
            workout_data: {
              workout_name: genResult.data.workout_name,
              exercises: genResult.data.exercises.map((ex) => ({
                exercise_name: ex.exercise_name,
                sets: ex.sets.map((s) => ({
                  target_load_kg: s.target_load_kg,
                  target_reps: s.target_reps,
                  target_duration_seconds: s.target_duration_seconds,
                })),
              })),
            },
          };
          return {
            result: {
              position: pw.queue_position,
              status: "ready",
              source: generationSource,
            },
            row: {
              id: pw.id,
              queue_position: pw.queue_position,
              status: "ready",
              focus_area: pw.focus_area,
              workout_data: genResult.data as unknown as Record<
                string,
                unknown
              >,
              generation_source: generationSource,
              generated_at: generatedAt,
            },
            context,
          };
        })
      );

      let waveFailed = false;
      settled.forEach((outcome, index) => {
        const pw = wave[index];
        if (outcome.status === "rejected") {
          waveFailed = true;
          const error =
            outcome.reason instanceof Error
              ? outcome.reason.message
              : String(outcome.reason);
          captureQueueFailureEvent({
            userId: user.id,
            requestId,
            stage: "generation",
            error,
            startedAt: queueStartedAt,
            trigger,
            queuePosition: pw.queue_position,
            workoutId: pw.id,
          });
          results.push({
            position: pw.queue_position,
            status: "failed",
            error,
          });
          return;
        }

        results.push(outcome.value.result);
        if (outcome.value.row) generatedRows.push(outcome.value.row);
        if (outcome.value.context) {
          completedQueueContext.set(
            outcome.value.context.queue_position,
            outcome.value.context
          );
        }
        if (outcome.value.result.status !== "ready") waveFailed = true;
      });

      if (waveFailed) break;
    }

    generatedRows.sort((a, b) => a.queue_position - b.queue_position);
    results.sort((a, b) => a.position - b.position);

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

    await trace.stage("persistence", { workout_count: generatedRows.length });
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
      await trace.finish("failed", {
        error_code: "queue_replace_failed",
        error_message: replaceError.message,
      });
      return jsonResponse(
        { error: "Failed to save workout queue", request_id: requestId },
        500
      );
    }

    queueSaved = true;
    for (const item of workoutTraces) {
      await item.trace.finish(
        item.source === "llm" ? "succeeded" : "succeeded_with_fallback",
        {
          generation_source: item.source,
          fallback_reason: item.fallbackReason,
          final_output: item.output,
        }
      );
    }
    await trace.finish(
      fallbackCount ? "succeeded_with_fallback" : "succeeded",
      { fallback_reason: fallbackCount ? "child_workout_fallback" : undefined }
    );
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

    return jsonResponse({
      success: true,
      count,
      trigger,
      results,
      request_id: requestId,
    });
  } catch (err) {
    console.error("[generate-workout-queue] Unhandled error:", err);
    await trace?.finish("failed", {
      error_code: "queue_failed",
      error_message: err instanceof Error ? err.message : String(err),
    });
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
    return jsonResponse(
      { error: "Internal server error", request_id: requestIdForTelemetry },
      500
    );
  } finally {
    if (!queueSaved) {
      for (const item of workoutTraces) {
        await item.trace.finish("failed", {
          error_code: "queue_aborted",
          error_message:
            "Queue replacement did not commit; previous queue retained",
        });
      }
      await trace?.finish("failed", {
        error_code: "queue_aborted",
        error_message: "Queue generation did not complete",
      });
    }
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
