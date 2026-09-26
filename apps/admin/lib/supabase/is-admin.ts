import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Reads `profiles.is_admin` for `userId` with the caller's own session, so RLS
 * still applies. Any error or missing row counts as not an admin.
 */
export async function isAdmin(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .single();

  return profile?.is_admin === true;
}
