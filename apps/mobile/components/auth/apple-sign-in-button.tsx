import * as AppleAuthentication from "expo-apple-authentication";
import { useState } from "react";
import { Platform, StyleSheet } from "react-native";

import { supabase } from "@/lib/supabase";

export function AppleSignInButton() {
  const [isLoading, setIsLoading] = useState(false);

  if (Platform.OS !== "ios") {
    return null;
  }

  async function handleAppleSignIn() {
    setIsLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (credential.identityToken) {
        await supabase.auth.signInWithIdToken({
          provider: "apple",
          token: credential.identityToken,
        });
        // onAuthStateChange handles routing
      }
    } catch (e: unknown) {
      const error = e as { code?: string };
      if (error.code === "ERR_REQUEST_CANCELED") {
        // User cancelled — do nothing
      } else {
        console.warn("[apple-sign-in] error:", error);
      }
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
