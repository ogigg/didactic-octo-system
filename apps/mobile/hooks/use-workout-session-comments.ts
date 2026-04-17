import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/hooks/use-auth";
import {
  createWorkoutSessionComment,
  listCommentsForSession,
  listRecentWorkoutSessionComments,
} from "@/lib/api/workout-session-comments";
import { workoutSessionCommentKeys } from "@/lib/query-keys";

export function useRecentWorkoutSessionComments(limit = 3) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: userId
      ? workoutSessionCommentKeys.recent(userId, limit)
      : ["workout-session-comments", "disabled"],
    queryFn: () => listRecentWorkoutSessionComments(userId!, limit),
    enabled: !!userId,
  });
}

export function useCommentsForSession(sessionId: string | null | undefined) {
  return useQuery({
    queryKey: sessionId
      ? workoutSessionCommentKeys.forSession(sessionId)
      : ["workout-session-comments", "disabled-session"],
    queryFn: () => listCommentsForSession(sessionId!),
    enabled: !!sessionId,
  });
}

export function useCreateWorkoutSessionComment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (input: { sessionId: string; comment: string }) => {
      if (!user?.id) throw new Error("Not authenticated");
      return createWorkoutSessionComment({
        userId: user.id,
        sessionId: input.sessionId,
        comment: input.comment,
      });
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({
        queryKey: workoutSessionCommentKeys.all,
      });
      queryClient.invalidateQueries({
        queryKey: workoutSessionCommentKeys.forSession(
          created.workout_session_id
        ),
      });
    },
  });
}
