import * as AuthSession from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { normalizeAuthError, trackEvent } from "@/lib/track-event";

export function GoogleSignInButton() {
  const { t } = useTranslation("auth");
  const [isLoading, setIsLoading] = useState(false);

  const [_request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    redirectUri: AuthSession.makeRedirectUri({ scheme: "sweaty" }),
  });

  useEffect(() => {
    if (!response) return;

    if (response.type !== "success") {
      trackEvent("signin_failed", {
        auth_method: "google",
        error_code:
          response.type === "cancel" || response.type === "dismiss"
            ? "provider_cancelled"
            : "provider_error",
        failure_stage: "provider",
      });
      return;
    }

    const { id_token } = response.params;
    if (!id_token) {
      trackEvent("signin_failed", {
        auth_method: "google",
        error_code: "missing_token",
        failure_stage: "provider",
      });
      return;
    }

    setIsLoading(true);
    void supabase.auth
      .signInWithIdToken({ provider: "google", token: id_token })
      .then(({ error }) => {
        if (error) {
          trackEvent("signin_failed", {
            auth_method: "google",
            error_code: normalizeAuthError(error),
            failure_stage: "supabase",
          });
          return;
        }

        trackEvent("user_signed_in", { auth_method: "google" });
        // onAuthStateChange handles routing
      })
      .catch((error: unknown) => {
        trackEvent("signin_failed", {
          auth_method: "google",
          error_code: normalizeAuthError(error),
          failure_stage: "supabase",
        });
      })
      .finally(() => setIsLoading(false));
  }, [response]);

  async function handleGoogleSignIn() {
    if (isLoading) return;
    trackEvent("signin_started", { auth_method: "google" });
    try {
      await promptAsync();
    } catch (error: unknown) {
      trackEvent("signin_failed", {
        auth_method: "google",
        error_code: normalizeAuthError(error),
        failure_stage: "provider",
      });
    }
  }

  return (
    <Button
      label={t("google.buttonLabel")}
      onPress={() => void handleGoogleSignIn()}
      variant="secondary"
      disabled={isLoading}
      accessibilityLabel={t("google.buttonLabel")}
    />
  );
}
