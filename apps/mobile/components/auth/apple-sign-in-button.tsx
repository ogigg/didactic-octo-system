import * as AppleAuthentication from "expo-apple-authentication";
import { useState } from "react";
import { Platform, StyleSheet } from "react-native";

import { supabase } from "@/lib/supabase";
import { normalizeAuthError, trackEvent } from "@/lib/track-event";

function logAppleAuth(message: string, details?: Record<string, unknown>) {
  // eslint-disable-next-line no-console -- simulator-only auth diagnostics
  if (__DEV__) console.info(`[apple-auth] ${message}`, details ?? "");
}

function warnAppleAuth(message: string, error?: unknown) {
  if (__DEV__)
    console.warn(
      `[apple-auth] ${message}`,
      error === undefined ? "" : safeErrorDetails(error)
    );
}

function safeErrorDetails(error: unknown) {
  return {
    code:
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string"
        ? error.code
        : "unknown",
    category: normalizeAuthError(error),
  };
}

export function AppleSignInButton() {
  const [isLoading, setIsLoading] = useState(false);

  if (Platform.OS !== "ios") {
    return null;
  }

  async function handleAppleSignIn() {
    setIsLoading(true);
    trackEvent("signin_started", { auth_method: "apple" });

    try {
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      logAppleAuth("availability checked", {
        isAvailable,
        platform: Platform.OS,
      });
      if (!isAvailable) {
        warnAppleAuth("Sign in with Apple is unavailable");
        trackEvent("signin_failed", {
          auth_method: "apple",
          error_code: "provider_unavailable",
          failure_stage: "provider",
        });
        return;
      }

      logAppleAuth("opening native sign-in prompt");
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      logAppleAuth("native prompt completed", {
        hasIdentityToken: Boolean(credential.identityToken),
      });

      if (!credential.identityToken) {
        warnAppleAuth("Apple returned no identity token");
        trackEvent("signin_failed", {
          auth_method: "apple",
          error_code: "missing_token",
          failure_stage: "provider",
        });
        return;
      }

      logAppleAuth("sending identity token to Supabase");
      const { error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
      });

      if (error) {
        warnAppleAuth("Supabase rejected the Apple credential", error);
        trackEvent("signin_failed", {
          auth_method: "apple",
          error_code: normalizeAuthError(error),
          failure_stage: "supabase",
        });
        return;
      }

      logAppleAuth("Supabase sign-in succeeded");
      trackEvent("user_signed_in", { auth_method: "apple" });
      // onAuthStateChange handles routing
    } catch (e: unknown) {
      warnAppleAuth("Native sign-in failed", e);
      trackEvent("signin_failed", {
        auth_method: "apple",
        error_code: normalizeAuthError(e),
        failure_stage: "provider",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={12}
      style={styles.button}
      onPress={() => {
        if (!isLoading) {
          void handleAppleSignIn();
        }
      }}
    />
  );
}

const styles = StyleSheet.create({
  button: { height: 50, width: "100%" },
});
