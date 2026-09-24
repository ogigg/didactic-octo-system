import { useAuthStore } from "@/stores/auth-store";

export function useAuth() {
  const session = useAuthStore((s) => s.session);
  const isInitialized = useAuthStore((s) => s.isInitialized);

  const profileStatus = useAuthStore((s) => s.profileStatus);
  const isPasswordRecovery = useAuthStore((s) => s.isPasswordRecovery);

  return {
    profileStatus,
    isPasswordRecovery,
    session,
    user: session?.user ?? null,
    isAuthenticated: session !== null,
    isInitialized,
  };
}
