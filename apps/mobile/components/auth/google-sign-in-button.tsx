import * as AuthSession from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

export function GoogleSignInButton() {
  const { t } = useTranslation("auth");
  const [isLoading, setIsLoading] = useState(false);

  const [_request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    redirectUri: AuthSession.makeRedirectUri({ scheme: "mobile" }),
  });

  useEffect(() => {
    if (response?.type === "success") {
      const { id_token } = response.params;
      if (id_token) {
        setIsLoading(true);
        supabase.auth
          .signInWithIdToken({ provider: "google", token: id_token })
          .finally(() => setIsLoading(false));
        // onAuthStateChange handles routing
      }
    }
  }, [response]);

  return (
    <Button
      label={t("google.buttonLabel")}
      onPress={() => promptAsync()}
      variant="secondary"
      disabled={isLoading}
      accessibilityLabel={t("google.buttonLabel")}
    />
  );
}
