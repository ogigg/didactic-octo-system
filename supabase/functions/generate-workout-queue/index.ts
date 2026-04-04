import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import {
  generateSingleWorkout,
  getFocusAreaForPosition,
  type HistorySession,
  type ProfileData,
  type QueueContextItem,
  type StrengthBaseline,
} from "../_shared/generator.ts";

// ---------------------------------------------------------------------------
// Request Schema
// ---------------------------------------------------------------------------

const requestSchema = z.object({
  count: z.number().int().min(1).max(7),
  trigger: z.enum(["onboarding", "preference_change"]),
});

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

    // 6. Check for concurrent generation — skip if already in progress
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
      return jsonResponse({
        skipped: true,
        reason: "generation_already_in_progress",
      });
    }

    // 7. Clear existing pending workouts for this user
    const { error: deleteError } = await userClient
      .from("pending_workouts")
      .delete()
      .eq("user_id", user.id);

    if (deleteError) {
      console.error(
        "[generate-workout-queue] Error clearing queue:",
        deleteError
      );
      return errorResponse("Failed to clear existing queue", 500);
    }

    // 8. Create N pending_workout rows with status 'queued'
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
      return errorResponse("Failed to create workout queue", 500);
    }

    // 9. Generate each workout sequentially
    const results: {
      position: number;
      status: string;
      source?: string;
      error?: string;
    }[] = [];
    const queueContext: QueueContextItem[] = [];

    for (const pw of insertedWorkouts) {
      console.log(
        `[generate-workout-queue] Generating ${pw.queue_position}/${count} (focus: ${pw.focus_area})`
      );

      // Set status to 'generating'
      await userClient
        .from("pending_workouts")
        .update({ status: "generating" })
        .eq("id", pw.id);

      // Generate
      const genResult = await generateSingleWorkout({
        supabaseClient: userClient,
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
      });

      if (genResult.success && genResult.data) {
        await userClient
          .from("pending_workouts")
          .update({
            workout_data: genResult.data as unknown as Record<string, unknown>,
            generation_source: genResult.generationSource,
            status: "ready",
            generated_at: new Date().toISOString(),
          })
          .eq("id", pw.id);

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

    return jsonResponse({ success: true, count, trigger, results });
  } catch (err) {
    console.error("[generate-workout-queue] Unhandled error:", err);
    return errorResponse("Internal server error", 500);
  }
});
