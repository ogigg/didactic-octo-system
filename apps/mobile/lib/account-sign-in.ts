import type { User } from "@supabase/supabase-js";

const APPLE_PRIVATE_RELAY_DOMAIN = "@privaterelay.appleid.com";

/** Sign-in methods the app offers, in display order. */
export const SIGN_IN_PROVIDERS = ["email", "apple", "google"] as const;

export type SignInProvider = (typeof SIGN_IN_PROVIDERS)[number];

export interface AccountSignIn {
  email: string | null;
  isApplePrivateRelay: boolean;
  /** Linked methods the app supports, in `SIGN_IN_PROVIDERS` order. */
  providers: SignInProvider[];
  /** Only set when several methods are linked, so a lone method isn't labelled. */
  lastUsedProvider: SignInProvider | null;
}

export function isApplePrivateRelayEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(APPLE_PRIVATE_RELAY_DOMAIN);
}

function isSignInProvider(provider: string): provider is SignInProvider {
  return (SIGN_IN_PROVIDERS as readonly string[]).includes(provider);
}

/**
 * Maps the Supabase user to what account settings shows. Keep the result on
 * screen only: it holds the email, which must never reach analytics or logs.
 */
export function getAccountSignIn(
  user: Pick<User, "email" | "identities">
): AccountSignIn {
  const identities = (user.identities ?? []).flatMap(
    ({ provider, last_sign_in_at }) =>
      isSignInProvider(provider)
        ? [{ provider, signedInAt: Date.parse(last_sign_in_at ?? "") }]
        : []
  );
  const providers = SIGN_IN_PROVIDERS.filter((provider) =>
    identities.some((identity) => identity.provider === provider)
  );

  let lastUsedProvider: SignInProvider | null = null;
  if (providers.length > 1) {
    let lastUsedAt = -Infinity;
    for (const { provider, signedInAt } of identities) {
      if (signedInAt > lastUsedAt) {
        lastUsedAt = signedInAt;
        lastUsedProvider = provider;
      }
    }
  }

  const email = user.email?.trim() || null;

  return {
    email,
    isApplePrivateRelay: email ? isApplePrivateRelayEmail(email) : false,
    providers,
    lastUsedProvider,
  };
}
