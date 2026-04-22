import { supabase } from "@/lib/supabase";

export interface ScheduleDeletionResult {
  scheduled_at: string;
  grace_days: number;
  apple_revoked: boolean | null;
}

/**
 * Soft-deletes the current user. Stamps `profiles.deletion_scheduled_at`
 * and signs the user out on the server. The row is hard-deleted by a
 * scheduled job after the grace period unless the user signs back in and
 * cancels.
 */
export async function scheduleAccountDeletion(): Promise<ScheduleDeletionResult> {
  // If the user is signed in via Apple, forward the provider refresh token
  // so the server can revoke it per App Store 5.1.1(v).
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const appleRefreshToken =
    session?.user?.app_metadata?.provider === "apple"
      ? (session.provider_refresh_token ?? undefined)
      : undefined;

  const { data, error } =
    await supabase.functions.invoke<ScheduleDeletionResult>("delete-account", {
      body: {
        confirmation: "DELETE",
        ...(appleRefreshToken
          ? { apple_refresh_token: appleRefreshToken }
          : {}),
      },
    });

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to schedule account deletion");
  }

  return data;
}

/**
 * Clears a pending deletion for the signed-in user. Safe to call as a no-op
 * on every sign-in — if nothing is scheduled, the server reports
 * `cancelled: false`.
 */
export async function cancelAccountDeletion(): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke<{
    cancelled: boolean;
  }>("cancel-account-deletion", {
    body: {},
  });

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data?.cancelled);
}
