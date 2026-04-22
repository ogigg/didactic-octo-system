// Apple Sign-in token revocation.
//
// Apple requires apps that support "Sign in with Apple" to revoke the user's
// refresh token when deleting their account (App Store guideline 5.1.1(v)).
// Supabase does not do this automatically — we must mint a `client_secret` JWT
// signed with the Apple private key and POST it to `appleid.apple.com/auth/revoke`
// alongside the user's provider refresh token.
//
// Env vars required (only needed when Apple sign-in is enabled):
//   APPLE_TEAM_ID          — 10-char Apple Developer team id
//   APPLE_KEY_ID           — 10-char Key ID from the Sign-in key
//   APPLE_CLIENT_ID        — the Services ID / bundle id registered with Apple
//   APPLE_PRIVATE_KEY      — PKCS8 PEM contents of the AuthKey .p8 file

import { SignJWT, importPKCS8 } from "https://esm.sh/jose@5.9.6";

const APPLE_REVOKE_URL = "https://appleid.apple.com/auth/revoke";

interface AppleConfig {
  teamId: string;
  keyId: string;
  clientId: string;
  privateKeyPem: string;
}

function loadAppleConfig(): AppleConfig | null {
  const teamId = Deno.env.get("APPLE_TEAM_ID");
  const keyId = Deno.env.get("APPLE_KEY_ID");
  const clientId = Deno.env.get("APPLE_CLIENT_ID");
  const privateKeyPem = Deno.env.get("APPLE_PRIVATE_KEY");

  if (!teamId || !keyId || !clientId || !privateKeyPem) {
    return null;
  }

  return {
    teamId,
    keyId,
    clientId,
    // Supabase env UI strips newlines — allow `\n` escapes in the stored value.
    privateKeyPem: privateKeyPem.replace(/\\n/g, "\n"),
  };
}

async function mintClientSecret(config: AppleConfig): Promise<string> {
  const privateKey = await importPKCS8(config.privateKeyPem, "ES256");
  const now = Math.floor(Date.now() / 1000);

  return await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: config.keyId })
    .setIssuer(config.teamId)
    .setIssuedAt(now)
    .setExpirationTime(now + 60 * 5) // 5 min — Apple allows up to 6 months
    .setAudience("https://appleid.apple.com")
    .setSubject(config.clientId)
    .sign(privateKey);
}

interface RevokeResult {
  attempted: boolean;
  ok: boolean;
  reason?: string;
}

/**
 * Revokes the given Apple refresh token. Swallows errors on purpose: Apple
 * revocation is best-effort and must never block local account deletion.
 */
export async function revokeAppleToken(
  refreshToken: string | undefined
): Promise<RevokeResult> {
  if (!refreshToken) {
    return { attempted: false, ok: false, reason: "missing_token" };
  }

  const config = loadAppleConfig();
  if (!config) {
    return { attempted: false, ok: false, reason: "apple_not_configured" };
  }

  try {
    const clientSecret = await mintClientSecret(config);

    const body = new URLSearchParams({
      client_id: config.clientId,
      client_secret: clientSecret,
      token: refreshToken,
      token_type_hint: "refresh_token",
    });

    const response = await fetch(APPLE_REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      console.warn("[delete-account] Apple revoke non-OK:", {
        status: response.status,
        body: text,
      });
      return {
        attempted: true,
        ok: false,
        reason: `apple_${response.status}`,
      };
    }

    return { attempted: true, ok: true };
  } catch (err) {
    console.warn("[delete-account] Apple revoke threw:", err);
    return { attempted: true, ok: false, reason: "apple_exception" };
  }
}
