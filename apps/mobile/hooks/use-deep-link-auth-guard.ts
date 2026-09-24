import { useRouter, useSegments } from "expo-router";
import { useEffect } from "react";

import { useAuth } from "@/hooks/use-auth";

/**
 * Top-level routes a signed-out user may stay on. The route groups redirect
 * on their own; everything else in the root stack requires a session.
 */
const OPEN_ROUTES = new Set([
  "(auth)",
  "(tabs)",
  "(onboarding)",
  "auth-link-error",
  "+not-found",
  "_sitemap",
]);

/**
 * Root-stack screens (opened by widgets, the Live Activity or other deep
 * links) sit outside the route groups' auth checks. Send signed-out users to
 * sign-in instead, e.g. when a widget still shows data from before sign-out or
 * the session ends on a settings screen. `dismissTo` returns to a sign-in
 * screen that is already open rather than stacking a second one.
 */
export function useDeepLinkAuthGuard(): void {
  const segments = useSegments();
  const router = useRouter();
  const { isAuthenticated, isInitialized, isPasswordRecovery } = useAuth();
  // `undefined` is the index route, which routes by itself.
  const route = segments[0] as string | undefined;

  useEffect(() => {
    if (!isInitialized || isAuthenticated || isPasswordRecovery) return;
    if (route !== undefined && !OPEN_ROUTES.has(route)) {
      router.dismissTo("/(auth)/sign-in");
    }
  }, [isAuthenticated, isInitialized, isPasswordRecovery, route, router]);
}
