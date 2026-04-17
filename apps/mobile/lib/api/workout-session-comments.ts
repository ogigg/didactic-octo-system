import { z } from "zod";

import { supabase } from "@/lib/supabase";

export const MAX_COMMENT_LENGTH = 500;

export const workoutSessionCommentSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  workout_session_id: z.string().uuid(),
  comment: z.string().min(1).max(MAX_COMMENT_LENGTH),
  created_at: z.string(),
});

export type WorkoutSessionComment = z.infer<typeof workoutSessionCommentSchema>;

export async function createWorkoutSessionComment(input: {
  userId: string;
  sessionId: string;
  comment: string;
}): Promise<WorkoutSessionComment> {
  const trimmed = input.comment.trim();
  if (!trimmed) throw new Error("Comment cannot be empty");

  const { data, error } = await supabase
    .from("workout_session_comments")
    .insert({
      user_id: input.userId,
      workout_session_id: input.sessionId,
      comment: trimmed.slice(0, MAX_COMMENT_LENGTH),
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return workoutSessionCommentSchema.parse(data);
}

export async function listRecentWorkoutSessionComments(
  userId: string,
  limit = 3
): Promise<WorkoutSessionComment[]> {
  const { data, error } = await supabase
    .from("workout_session_comments")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return z.array(workoutSessionCommentSchema).parse(data ?? []);
}

export async function listCommentsForSession(
  sessionId: string
): Promise<WorkoutSessionComment[]> {
  const { data, error } = await supabase
    .from("workout_session_comments")
    .select("*")
    .eq("workout_session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return z.array(workoutSessionCommentSchema).parse(data ?? []);
}
