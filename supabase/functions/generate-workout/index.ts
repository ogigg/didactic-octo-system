import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import {
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

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const RATE_LIMIT_SECONDS = 30;

type AppSupabaseClient = SupabaseClient<any, "public", any>;

// -----------------------------------------------------------------------------
// Request Schema
// -----------------------------------------------------------------------------

const requestSchema = z
  .object({
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
    pending_workout_claim_token: z.string().uuid().optional(),
    pending_workout_generation_version: z.number().int().positive().optional(),
    timezone_offset_minutes: z.number().int().min(-840).max(840).optional(),
  })
  .refine(
    (value) =>
      (value.pending_workout_claim_token === undefined) ===
      (value.pending_workout_generation_version === undefined),
    {
      message:
        "pending workout claim token and version must be provided together",
    }
  );

interface PendingWorkoutSnapshot {
  id: string;
  regeneration_count: number | null;
  regeneration_feedback: Record<string, unknown>[] | null;
  last_regenerated_at: string | null;
  workout_data: Record<string, unknown> | null;
  status: string;
  generation_version: number;
  generation_claim_token: string | null;
}

function toDateKeyForOffset(date: Date, timezoneOffsetMinutes: number): string {
  const shifted = new Date(date.getTime() - timezoneOffsetMinutes * 60_000);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

async function restorePendingWorkoutAfterFailure(params: {
  userClient: AppSupabaseClient;
  pendingWorkoutId: string;
  userId: string;
  generationVersion: number;
  claimToken: string;
}) {
  await params.userClient.rpc("fail_pending_workout_generation", {
    p_pending_workout_id: params.pendingWorkoutId,
    p_generation_version: params.generationVersion,
    p_claim_token: params.claimToken,
  });
}

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

  let pendingWorkoutSnapshot: PendingWorkoutSnapshot | null = null;
  let pendingWorkoutIdForRecovery: string | null = null;
  let pendingWorkoutPersisted = false;
  let userIdForRecovery: string | null = null;
  let userClientForRecovery: AppSupabaseClient | null = null;

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
    userClientForRecovery = userClient;
    userIdForRecovery = user.id;

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
      regeneration_feedback,
      pending_workout_id,
      pending_workout_claim_token,
      pending_workout_generation_version,
      timezone_offset_minutes,
    } = parsed.data;
    pendingWorkoutIdForRecovery = pending_workout_id ?? null;
    const isPreclaimedRecovery =
      pending_workout_claim_token !== undefined &&
      pending_workout_generation_version !== undefined;

    // 3. Generation allowance check (pending workout regeneration only — not used for direct generation)
    if (pending_workout_id && !isPreclaimedRecovery) {
      const allowance = await checkGenerationAllowance(
        supabaseClient,
        user.id,
        1
      );

      if (!allowance.allowed) {
        console.log(
          `[generate-workout] Limit reached for user ${user.id}: ${allowance.used}/5 used`
        );
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

    // 4. Rate limiting (skip for pending workout regeneration — has its own daily limit)
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

    // 5. Daily regeneration limit for pending workouts
    if (pending_workout_id) {
      const { data: pendingWorkout } = await userClient
        .from("pending_workouts")
        .select(
          "id, regeneration_count, regeneration_feedback, last_regenerated_at, workout_data, status, generation_version, generation_claim_token"
        )
        .eq("id", pending_workout_id)
        .eq("user_id", user.id)
        .single();

      if (!pendingWorkout) {
        return errorResponse("Pending workout not found", 404);
      }

      if (!isPreclaimedRecovery && pendingWorkout.last_regenerated_at) {
        const currentTimezoneOffsetMinutes = timezone_offset_minutes ?? 0;
        const sameDay =
          toDateKeyForOffset(
            new Date(pendingWorkout.last_regenerated_at),
            currentTimezoneOffsetMinutes
          ) === toDateKeyForOffset(new Date(), currentTimezoneOffsetMinutes);

        if (sameDay) {
          return errorResponse(
            "Daily regeneration limit reached. Try again tomorrow or edit the workout instead.",
            429
          );
        }
      }

      pendingWorkoutSnapshot = pendingWorkout;

      if (pending_workout_claim_token && pending_workout_generation_version) {
        if (
          pendingWorkout.status !== "regenerating" ||
          pendingWorkout.generation_claim_token !==
            pending_workout_claim_token ||
          pendingWorkout.generation_version !==
            pending_workout_generation_version
        ) {
          return errorResponse("Pending workout recovery claim is stale.", 409);
        }
      } else {
        const { data: claims, error: claimError } = await userClient.rpc(
          "claim_pending_workout_generation",
          {
            p_pending_workout_id: pending_workout_id,
            p_expected_version: pendingWorkout.generation_version,
            p_claim_reason: "regeneration",
            p_allow_corrupt_ready: false,
          }
        );
        const claim = Array.isArray(claims) ? claims[0] : null;

        if (claimError) {
          return errorResponse("Failed to claim workout regeneration.", 500);
        }
        if (!claim) {
          return errorResponse(
            "Workout regeneration is already in progress.",
            409
          );
        }

        pendingWorkoutSnapshot = {
          ...pendingWorkout,
          status: "regenerating",
          generation_version: claim.generation_version,
          generation_claim_token: claim.claim_token,
        };
      }
    }

    // 6. Fetch profile
    const { data: profile, error: profileError } = await userClient
      .from("profiles")
      .select("goal, custom_goal, weekly_frequency, gender")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      if (pending_workout_id && pendingWorkoutSnapshot) {
        await restorePendingWorkoutAfterFailure({
          userClient,
          pendingWorkoutId: pending_workout_id,
          userId: user.id,
          generationVersion: pendingWorkoutSnapshot.generation_version,
          claimToken: pendingWorkoutSnapshot.generation_claim_token!,
        });
        pendingWorkoutSnapshot = null;
      }

      return errorResponse(
        "Profile not found. Complete onboarding first.",
        400
      );
    }

    const profileGoal: string = profile.goal ?? "improve_fitness";

    // 7. Fetch recent workout history (last 4 completed sessions)
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

    // 8. Fetch strength baselines
    const { data: baselines } = await userClient
      .from("strength_baselines")
      .select("exercise_key, load_kg, reps")
      .eq("user_id", user.id);

    const strengthBaselines: StrengthBaseline[] =
      (baselines as StrengthBaseline[] | null) ?? [];

    // 9. Fetch queue context (other pending workouts — for exercise variety during regeneration)
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

    // 10. Fetch exercise preferences
    const { data: prefRows } = await userClient
      .from("exercise_preferences")
      .select("exercise_id, preference")
      .eq("user_id", user.id);

    const exercisePreferences: ExercisePreference[] =
      (prefRows as ExercisePreference[] | null) ?? [];

    // 10b. Fetch last 3 session comments
    const { data: commentRows } = await userClient
      .from("workout_session_comments")
      .select("comment, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3);

    const recentComments: RecentSessionComment[] =
      (commentRows as RecentSessionComment[] | null) ?? [];

    // 11. Generate workout
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
    });

    if (!result.success || !result.data) {
      if (pending_workout_id && pendingWorkoutSnapshot) {
        await restorePendingWorkoutAfterFailure({
          userClient,
          pendingWorkoutId: pending_workout_id,
          userId: user.id,
          generationVersion: pendingWorkoutSnapshot.generation_version,
          claimToken: pendingWorkoutSnapshot.generation_claim_token!,
        });
      }

      return errorResponse(result.error ?? "Workout generation failed", 500);
    }

    // 12. If regenerating a pending workout, update it
    if (pending_workout_id) {
      const { data: completed, error: updateError } = await userClient.rpc(
        "complete_pending_workout_generation",
        {
          p_pending_workout_id: pending_workout_id,
          p_generation_version: pendingWorkoutSnapshot!.generation_version,
          p_claim_token: pendingWorkoutSnapshot!.generation_claim_token!,
          p_workout_data: result.data as unknown as Record<string, unknown>,
          p_generation_source: result.generationSource,
          p_is_regeneration: !isPreclaimedRecovery,
          p_regeneration_feedback: regeneration_feedback ?? null,
        }
      );

      if (updateError) {
        await restorePendingWorkoutAfterFailure({
          userClient,
          pendingWorkoutId: pending_workout_id,
          userId: user.id,
          generationVersion: pendingWorkoutSnapshot!.generation_version,
          claimToken: pendingWorkoutSnapshot!.generation_claim_token!,
        });

        return errorResponse("Failed to save regenerated workout.", 500);
      }

      if (completed !== true) {
        console.log(
          "[generate-workout] Stale worker completion ignored",
          pending_workout_id
        );
      }
      pendingWorkoutPersisted = completed === true;

      pendingWorkoutSnapshot = null;
    }

    console.log("[generate-workout] Success!", {
      generationSource: result.generationSource,
      exerciseCount: result.data.exercises.length,
      pendingWorkoutRegenerated: !!pending_workout_id,
    });

    // Record usage for pending workout regeneration
    if (
      pending_workout_id &&
      pendingWorkoutPersisted &&
      !isPreclaimedRecovery
    ) {
      await recordGenerationUsage(supabaseClient, user.id, "regeneration", 1);
    }

    return jsonResponse(result.data);
  } catch (err) {
    if (
      pendingWorkoutIdForRecovery &&
      pendingWorkoutSnapshot &&
      userIdForRecovery &&
      userClientForRecovery
    ) {
      await restorePendingWorkoutAfterFailure({
        userClient: userClientForRecovery,
        pendingWorkoutId: pendingWorkoutIdForRecovery,
        userId: userIdForRecovery,
        generationVersion: pendingWorkoutSnapshot.generation_version,
        claimToken: pendingWorkoutSnapshot.generation_claim_token!,
      });
    }

    console.error("[generate-workout] Unhandled error:", err);
    return errorResponse("Internal server error", 500);
  }
});
