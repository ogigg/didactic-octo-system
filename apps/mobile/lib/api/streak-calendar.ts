import { z } from "zod";

import { supabase } from "@/lib/supabase";
import type { StreakCalendarData } from "@/lib/streak-calendar";

const protectedEventTypes = [
  "lifetime_rescue_used",
  "earned_freeze_used",
  "pro_freeze_used",
  "pro_auto_freeze_used",
] as const;

const qualifyingSessionSchema = z.object({
  id: z.string(),
  completed_at: z.string(),
});

const protectionEventSchema = z.object({
  event_type: z.enum(protectedEventTypes),
  covered_week_start: z.string(),
});

async function getAuthenticatedUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error(error?.message ?? "Not authenticated");
  }

  return user.id;
}

/**
 * Fetches the two persisted inputs needed to paint streak weeks. The nested
 * relationship/filter mirrors get_streak_status: a completed session only
 * qualifies after at least one set log is marked completed.
 */
export async function fetchStreakCalendarData(
  fromIso: string,
  toIso: string
): Promise<StreakCalendarData> {
  await getAuthenticatedUserId();

  const [sessionsResult, eventsResult] = await Promise.all([
    supabase
      .from("workout_sessions")
      .select(
        "id, completed_at, session_exercises!inner(session_sets!inner(set_logs!inner(completed)))"
      )
      .eq("status", "completed")
      .not("completed_at", "is", null)
      .gte("completed_at", fromIso)
      .lte("completed_at", toIso)
      .eq("session_exercises.session_sets.set_logs.completed", true)
      .order("completed_at", { ascending: true }),
    supabase
      .from("streak_protection_events")
      .select("event_type, covered_week_start")
      .in("event_type", protectedEventTypes)
      .not("covered_week_start", "is", null)
      .gte("covered_week_start", fromIso.slice(0, 10))
      .lte("covered_week_start", toIso.slice(0, 10))
      .order("covered_week_start", { ascending: true }),
  ]);

  if (sessionsResult.error) {
    throw new Error(sessionsResult.error.message);
  }
  if (eventsResult.error) {
    throw new Error(eventsResult.error.message);
  }

  const sessions = z
    .array(qualifyingSessionSchema)
    .parse(sessionsResult.data ?? []);
  const events = z.array(protectionEventSchema).parse(eventsResult.data ?? []);

  return {
    qualifyingCompletedAtDates: sessions.map((session) => session.completed_at),
    protectedWeekStarts: events.map((event) => event.covered_week_start),
  };
}
