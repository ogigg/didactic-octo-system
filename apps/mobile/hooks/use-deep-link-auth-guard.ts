import { useRootNavigationState, useRouter, useSegments } from "expo-router";
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
 * the session ends on a settings screen (signing out, deleting the account).
 *
 * Pop the whole root stack rather than putting sign-in on top of it: the
 * screens left below would stay reachable with the back gesture. The first
 * screen, the `(tabs)` anchor or another route group, redirects signed-out
 * users to sign-in by itself.
 *
 * The stack size comes from the rendered navigation state: on a cold start
 * the router store still holds a partial state, so `router.canDismiss()`
 * reports nothing to pop.
 */
export function useDeepLinkAuthGuard(): void {
  const segments = useSegments();
  const router = useRouter();
  const rootState = useRootNavigationState();
  const { isAuthenticated, isInitialized, isPasswordRecovery } = useAuth();
  // `undefined` is the index route, which routes by itself.
  const route = segments[0] as string | undefined;
  // Screens in the root stack: the root state wraps it in one `__root` route.
  const rootStackSize = rootState?.routes?.[0]?.state?.routes?.length ?? 0;

  useEffect(() => {
    if (!isInitialized || isAuthenticated || isPasswordRecovery) return;
    // Wait until the root stack has rendered.
    if (rootStackSize === 0) return;
    if (route !== undefined && !OPEN_ROUTES.has(route)) {
      if (rootStackSize > 1) {
        router.dismissAll();
      } else {
        router.replace("/(auth)/sign-in");
      }
    }
  }, [
    isAuthenticated,
    isInitialized,
    isPasswordRecovery,
    rootStackSize,
    route,
    router,
  ]);
}
