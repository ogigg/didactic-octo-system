import { useAuthStore } from "@/stores/auth-store";

export function useAuth() {
  const session = useAuthStore((s) => s.session);
  const isInitialized = useAuthStore((s) => s.isInitialized);

  return {
    session,
    user: session?.user ?? null,
    isAuthenticated: session !== null,
    isInitialized,
  };
}
