import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import {
  generateSingleWorkout,
  getFocusAreaForPosition,
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
import {
  processQueueGeneration,
  QueueFailurePersistenceError,
} from "../_shared/queue-generation.ts";

// ---------------------------------------------------------------------------
// Request Schema
// ---------------------------------------------------------------------------

const requestSchema = z.object({
  count: z.number().int().min(1).max(7),
  trigger: z.enum(["onboarding", "preference_change"]),
});

const startedQueueRowSchema = z.object({
  started: z.literal(true),
  workout_id: z.string().uuid(),
  workout_queue_position: z.number().int(),
  workout_focus_area: z.enum([
    "push",
    "pull",
    "legs",
    "upper",
    "lower",
    "full_body",
  ]),
  run_id: z.string().uuid(),
});

const skippedQueueRowSchema = z.object({
  started: z.literal(false),
  workout_id: z.null(),
  workout_queue_position: z.null(),
  workout_focus_area: z.null(),
  run_id: z.null(),
});

const startQueueResponseSchema = z.array(
  z.discriminatedUnion("started", [
    startedQueueRowSchema,
    skippedQueueRowSchema,
  ])
);

// ---------------------------------------------------------------------------
// Main Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  console.log("[generate-workout-queue] Request received");

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

    // 2. Parse request
    const body = await req.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        `Invalid request: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
        400
      );
    }
    const { count, trigger } = parsed.data;

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

    // 8. Atomically claim this user's rebuild and create its owned rows.
    const generationRunId = crypto.randomUUID();
    const focusAreas = Array.from({ length: count }, (_, index) =>
      getFocusAreaForPosition(profile.training_split, index + 1)
    );
    const { data: queueStartData, error: queueStartError } =
      await userClient.rpc("start_pending_workout_generation", {
        p_run_id: generationRunId,
        p_focus_areas: focusAreas,
      });

    if (queueStartError) {
      console.error(
        "[generate-workout-queue] Failed to start owned queue:",
        queueStartError
      );
      return errorResponse("Failed to create workout queue", 500);
    }

    const parsedQueueStart = startQueueResponseSchema.safeParse(queueStartData);
    if (!parsedQueueStart.success || parsedQueueStart.data.length === 0) {
      console.error("[generate-workout-queue] Invalid queue start response:", {
        userId: user.id,
        generationRunId,
        issues: parsedQueueStart.success
          ? ["Empty response"]
          : parsedQueueStart.error.issues,
      });
      return errorResponse("Failed to create workout queue", 500);
    }

    if (!parsedQueueStart.data[0].started) {
      console.log(
        "[generate-workout-queue] Generation already in progress, skipping",
        { userId: user.id }
      );
      return jsonResponse({
        skipped: true,
        reason: "generation_already_in_progress",
      });
    }

    const insertedWorkouts = parsedQueueStart.data
      .filter(
        (row): row is z.infer<typeof startedQueueRowSchema> => row.started
      )
      .map((row) => ({
        id: row.workout_id,
        queue_position: row.workout_queue_position,
        focus_area: row.workout_focus_area,
      }));

    if (
      insertedWorkouts.length !== count ||
      parsedQueueStart.data.some(
        (row) => row.started && row.run_id !== generationRunId
      )
    ) {
      console.error("[generate-workout-queue] Queue ownership mismatch:", {
        userId: user.id,
        generationRunId,
        expectedCount: count,
        actualCount: insertedWorkouts.length,
      });
      return errorResponse("Failed to create workout queue", 500);
    }

    // 9. Generate each workout sequentially
    const queueContext: QueueContextItem[] = [];

    const results = await processQueueGeneration({
      items: insertedWorkouts,
      markGenerating: async (pendingWorkout) => {
        console.log(
          `[generate-workout-queue] Generating ${pendingWorkout.queue_position}/${count} (focus: ${pendingWorkout.focus_area})`
        );

        const { data, error } = await userClient
          .from("pending_workouts")
          .update({ status: "generating" })
          .eq("id", pendingWorkout.id)
          .eq("generation_run_id", generationRunId)
          .eq("status", "queued")
          .select("id")
          .maybeSingle();

        if (error) {
          throw new Error(
            `Failed to mark workout generating: ${error.message}`
          );
        }
        if (!data) {
          throw new Error("Queue ownership lost before generation");
        }
      },
      generate: async (pendingWorkout) => {
        const generated = await generateSingleWorkout({
          supabaseClient: userClient,
          userId: user.id,
          profile: { ...profile, goal: profileGoal } as ProfileData,
          trainingSplit: profile.training_split,
          durationMinutes: profile.session_duration_minutes ?? 45,
          equipment: profile.equipment_level,
          trainingStyle: profile.training_style,
          difficulty: profile.difficulty_level,
          customPrompt: profile.training_custom_prompt ?? undefined,
          focusArea: pendingWorkout.focus_area ?? undefined,
          strengthBaselines,
          queueContext: queueContext.length > 0 ? queueContext : undefined,
          history,
          exercisePreferences:
            exercisePreferences.length > 0 ? exercisePreferences : undefined,
          recentComments:
            recentComments.length > 0 ? recentComments : undefined,
        });

        if (
          !generated.success ||
          !generated.data ||
          !generated.generationSource
        ) {
          throw new Error(generated.error ?? "Workout generation failed");
        }

        return {
          data: generated.data,
          source: generated.generationSource,
        };
      },
      saveReady: async (pendingWorkout, generated) => {
        const { data, error } = await userClient
          .from("pending_workouts")
          .update({
            workout_data: generated.data as unknown as Record<string, unknown>,
            generation_source: generated.source,
            status: "ready",
            generated_at: new Date().toISOString(),
          })
          .eq("id", pendingWorkout.id)
          .eq("generation_run_id", generationRunId)
          .eq("status", "generating")
          .select("id")
          .maybeSingle();

        if (error) {
          throw new Error(`Failed to save generated workout: ${error.message}`);
        }
        if (!data) {
          throw new Error("Queue ownership lost before saving workout");
        }

        queueContext.push({
          queue_position: pendingWorkout.queue_position,
          focus_area: pendingWorkout.focus_area,
          workout_data: {
            workout_name: generated.data.workout_name,
            exercises: generated.data.exercises.map((ex) => ({
              exercise_name: ex.exercise_name,
              sets: ex.sets.map((s) => ({
                target_load_kg: s.target_load_kg,
                target_reps: s.target_reps,
              })),
            })),
          },
        });
      },
      markFailed: async (pendingWorkout) => {
        const { data, error } = await userClient
          .from("pending_workouts")
          .update({ status: "failed" })
          .eq("id", pendingWorkout.id)
          .eq("generation_run_id", generationRunId)
          .in("status", ["queued", "generating"])
          .select("id")
          .maybeSingle();

        if (error) {
          throw new Error(`Failed to mark workout failed: ${error.message}`);
        }
        if (!data) {
          throw new Error("Queue ownership lost before persisting failure");
        }
      },
      logError: ({ item, stage, error }) => {
        console.error("[generate-workout-queue] Position failed", {
          userId: user.id,
          position: item.queue_position,
          total: count,
          focusArea: item.focus_area,
          stage,
          error,
        });
      },
      onCompleted:
        trigger === "preference_change"
          ? async (completedResults) => {
              const successfulCount = completedResults.filter(
                (result) => result.status === "ready"
              ).length;
              if (successfulCount > 0) {
                await recordGenerationUsage(
                  supabaseClient,
                  user.id,
                  "preference_change",
                  successfulCount
                );
              }
            }
          : undefined,
    });

    console.log(
      `[generate-workout-queue] Complete for user ${user.id}:`,
      results
    );

    return jsonResponse({ success: true, count, trigger, results });
  } catch (err) {
    console.error("[generate-workout-queue] Unhandled error:", err);

    if (err instanceof QueueFailurePersistenceError) {
      return jsonResponse(
        {
          error: "queue_failure_persistence_failed",
          position: err.item.queue_position,
        },
        500
      );
    }

    return errorResponse("Internal server error", 500);
  }
});
