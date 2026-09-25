import { ProfileGate } from "@/components/auth/profile-gate";
import { StackActions, useNavigation } from "@react-navigation/native";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { useCallback } from "react";

import { useAuth } from "@/hooks/use-auth";
import { useOnboardingStore } from "@/stores/onboarding-store";

/**
 * Leaves the index route for `href`.
 *
 * On a cold start expo-router puts the root stack's anchor, `(tabs)`, under
 * index. Replacing index with `href` would then leave that anchor below it:
 * two home screens for a signed-in user, or a home screen under sign-in that
 * the back gesture reveals. So when there is a screen below, pop back to it
 * instead. The `(tabs)` layout applies the same recovery, onboarding and
 * sign-in redirects from there.
 */
function LeaveIndex({ href }: { href: Href }) {
  const router = useRouter();
  // The index screen's own navigator knows what is below it. The router
  // store doesn't yet on a cold start, so `router.canDismiss()` is false there.
  const navigation = useNavigation();

  useFocusEffect(
    useCallback(() => {
      if (navigation.canGoBack()) {
        navigation.dispatch(StackActions.popToTop());
      } else {
        router.replace(href);
      }
    }, [href, navigation, router])
  );

  return null;
}

export default function Index() {
  const { isAuthenticated, isInitialized, profileStatus, isPasswordRecovery } =
    useAuth();
  const { isCompleted, getNextUnfinishedStep } = useOnboardingStore();

  if (isPasswordRecovery) return <LeaveIndex href="/(auth)/reset-password" />;
  if (
    profileStatus === "error" ||
    (isAuthenticated && profileStatus !== "ready")
  )
    return <ProfileGate />;

  // Keep splash visible until auth is resolved
  if (!isInitialized) {
    return null;
  }

  if (!isAuthenticated) {
    return <LeaveIndex href="/(auth)/sign-in" />;
  }

  if (!isCompleted) {
    const nextStep = getNextUnfinishedStep();
    const target = nextStep === null ? "/(tabs)" : `/(onboarding)/${nextStep}`;
    return <LeaveIndex href={target as Href} />;
  }

  return <LeaveIndex href="/(tabs)" />;
}
