import { z } from "zod";

import { supabase } from "@/lib/supabase";

export interface LoginProviderHint {
  providers: string[];
  hasPassword: boolean;
}

const hintResponseSchema = z.object({
  providers: z.array(z.string()),
  has_password: z.boolean(),
});

/**
 * Looks up which OAuth providers an email is linked to. Intended to be called
 * only after a failed password sign-in so the user can be pointed back to
 * Apple/Google. Returns null on any failure — callers should silently fall
 * back to the generic invalid-credentials error.
 */
export async function fetchLoginProviderHint(
  email: string
): Promise<LoginProviderHint | null> {
  try {
    const { data, error } = await supabase.functions.invoke<{
      providers: string[];
      has_password: boolean;
    }>("login-provider-hint", {
      body: { email },
    });

    if (error || !data) {
      return null;
    }

    const parsed = hintResponseSchema.safeParse(data);
    if (!parsed.success) {
      return null;
    }

    return {
      providers: parsed.data.providers,
      hasPassword: parsed.data.has_password,
    };
  } catch {
    return null;
  }
}
