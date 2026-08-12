import * as AppleAuthentication from "expo-apple-authentication";
import { useState } from "react";
import { Platform, StyleSheet } from "react-native";

import { supabase } from "@/lib/supabase";
import { normalizeAuthError, trackEvent } from "@/lib/track-event";

export function AppleSignInButton() {
  const [isLoading, setIsLoading] = useState(false);

  if (Platform.OS !== "ios") {
    return null;
  }

  async function handleAppleSignIn() {
    setIsLoading(true);
    trackEvent("signin_started", { auth_method: "apple" });

    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        trackEvent("signin_failed", {
          auth_method: "apple",
          error_code: "missing_token",
          failure_stage: "provider",
        });
        return;
      }

      const { error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
      });

      if (error) {
        trackEvent("signin_failed", {
          auth_method: "apple",
          error_code: normalizeAuthError(error),
          failure_stage: "supabase",
        });
        return;
      }

      trackEvent("user_signed_in", { auth_method: "apple" });
      // onAuthStateChange handles routing
    } catch (e: unknown) {
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
