# OAuth Provider Login Hint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user who signed up via Apple or Google tries to log in with email + password, show them an inline banner on the sign-in screen: "Your account was previously used to log in with Apple. Please continue with Apple" (same for Google), instead of the generic "Invalid credentials" error.

**Architecture:** Supabase returns the same "Invalid login credentials" for a wrong password *and* for an OAuth-only account with no password, so the provider information must be resolved server-side from `auth.identities`. We add a small `SECURITY DEFINER` SQL RPC that maps an email to its linked auth providers plus whether a password identity exists, exposed through a new lightweight edge function (`login-provider-hint`) because the caller is unauthenticated at sign-in time. The mobile client calls this function only *after* a failed password sign-in and swaps the generic error for a provider-specific hint banner reusing the existing error-banner pattern in `sign-in.tsx`.

**Tech Stack:** Supabase (Postgres migration, Edge Functions/Deno, supabase-js@2), Zod, react-i18next, React Native (`StyleSheet.create`, existing banner styles)

---

## File Map

| File | Action | What changes |
| --- | --- | --- |
| `supabase/migrations/<ts>_add_login_provider_hint_rpc.sql` | Create | `SECURITY DEFINER` function `get_login_provider_hint(email)` reading `auth.identities`/`auth.users`; grants to `anon`, `authenticated` |
| `supabase/functions/login-provider-hint/index.ts` | Create | POST endpoint: Zod-validates `{ email }`, calls RPC, returns `{ providers, has_password }`; basic per-IP rate limit |
| `apps/mobile/lib/api/login-provider-hint.ts` | Create | Typed client wrapper around the edge function |
| `apps/mobile/app/(auth)/sign-in.tsx` | Modify | On invalid-credentials failure, consult the hint API and render a provider-specific banner |
| `apps/mobile/i18n/locales/en/auth.ts` | Modify | Add `errors.ssoAccountHint` key(s) |
| `apps/mobile/i18n/locales/pl/auth.ts` | Modify | Polish translations |
| `apps/mobile/app/(auth)/__tests__/sign-in.test.tsx` | Modify | Cover the new hint flow |
| `.ai/architecture.md` | Modify | Document the sign-in provider-hint step |

## Design Decisions

1. **Check runs after a failed password login, never before.** Only users who already hit "Invalid credentials" trigger a lookup. This keeps the happy path unchanged, avoids extra network calls, and narrows the enumeration surface (the response still reveals which provider an email uses — acceptable, mirroring common "Continue with SSO" UX, but we rate-limit).
2. **SQL RPC over `auth.admin.listUsers()`.** The admin API has no email filter, so paging all users server-side would be wasteful. A `SECURITY DEFINER` function scoped to one email lookup is O(1). It must be `revoke ... from public; grant execute ... to anon` so the signed-out sign-in screen can call it through the edge function.
3. **Edge function rather than direct client→RPC call.** Keeps the RPC behind CORS handling consistent with existing functions (`delete-account` pattern in `supabase/functions/_shared/cors.ts`), gives us a place to rate-limit, and hides DB details from the client. The function itself authenticates with the anon key (no user JWT exists yet).
4. **Hint replaces the generic error only when it applies.** If the account has a password identity too, the failed login was genuinely a wrong password → keep `errors.invalidCredentials`.

## Task 1: Database RPC

**Files:**

- Create: `supabase/migrations/<timestamp>_add_login_provider_hint_rpc.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Returns the auth providers linked to an email and whether the user can
-- sign in with a password. Used by the login-provider-hint edge function to
-- guide users whose account was created via Apple/Google OAuth.
create or replace function public.get_login_provider_hint(p_email text)
returns json
language sql
stable
security definer
set search_path = auth, public
as $$
  select json_build_object(
    'providers',
      coalesce(
        json_agg(distinct i.provider) filter (where i.provider is not null),
        '[]'::json
      ),
    'has_password', coalesce(
      bool_or(u.encrypted_password is not null and u.encrypted_password <> ''),
      false
    )
  )
  from auth.users u
  left join auth.identities i on i.user_id = u.id
  where lower(u.email) = lower(p_email)
$$;

revoke execute on function public.get_login_provider_hint(text) from public;
grant execute on function public.get_login_provider_hint(text) to anon, authenticated;
```

- [ ] **Step 2: Apply locally and smoke-test**

```
supabase db push --local
supabase db ... -- run: select public.get_login_provider_hint('some-oauth-user@example.com');
```

Verify: returns `{"providers": ["apple"], "has_password": false}` for an OAuth-only test user and `{"providers": ["email"], "has_password": true}` for an email/password user; `'{}'`-style empty result (`{"providers": [], "has_password": false}`) for unknown emails.

## Task 2: Edge function

**Files:**

- Create: `supabase/functions/login-provider-hint/index.ts`

- [ ] **Step 1: Implement the endpoint** (follow the structure of `supabase/functions/delete-account/index.ts`)

```ts
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";

const requestSchema = z.object({
  email: z.string().email(),
});
```

Behavior contract:

1. Handle `OPTIONS` via `corsHeaders()`; reject non-POST with 405.
2. Parse body with the Zod schema; 400 on failure.
3. Create an anon-key client (`SUPABASE_ANON_KEY`) with `persistSession: false`.
4. `rpc("get_login_provider_hint", { p_email: parsed.data.email })`.
5. Respond `{ providers: string[], has_password: boolean }` (200) — including for unknown emails (empty providers), so the client cannot distinguish "no such user".
6. Rate-limit: simple in-memory Map keyed by client IP (from request headers), e.g. max 10 requests/minute/IP → 429 otherwise. Log lookups without logging full emails (mask local part).

- [ ] **Step 2: Local verification**

Run `supabase functions serve login-provider-hint` and curl it with a known OAuth-test email and a malformed body; confirm status codes and payload shape.

## Task 3: Client wrapper

**Files:**

- Create: `apps/mobile/lib/api/login-provider-hint.ts`

- [ ] **Step 1: Typed fetch wrapper**

```ts
interface LoginProviderHint {
  providers: string[];
  hasPassword: boolean;
}
```

- Function `fetchLoginProviderHint(email: string): Promise<LoginProviderHint | null>` calling the edge function via the existing supabase client's `functions.invoke("login-provider-hint", { body: { email } })`.
- Validate the response payload with Zod before returning; return `null` on any failure (network, non-2xx) so the sign-in screen can silently fall back to the generic error. Never throw into the UI layer.

## Task 4: Sign-in screen wiring

**Files:**

- Modify: `apps/mobile/app/(auth)/sign-in.tsx`

- [ ] **Step 1: Add hint state and resolution logic**

In `onSubmit` (currently L53–69): keep the existing error mapping, but when the error message contains `"invalid"` (L63), call `fetchLoginProviderHint(data.email)` first. Decision table:

| Hint result | Banner shown |
| --- | --- |
| `providers` includes `"apple"` and `!hasPassword` | `t("errors.ssoAccountHint", { provider: "Apple" })` |
| `providers` includes `"google"` and `!hasPassword` | `t("errors.ssoAccountHint", { provider: "Google" })` |
| anything else / `null` | existing `t("errors.invalidCredentials")` |

If both apple and google are linked, prefer the most recently created identity (return `primary_provider` from the RPC instead of guessing client-side — simplest: have the SQL return `providers` ordered by `i.created_at` of latest identity per provider and let the client take `[0]`).

Clear `providerHint` state at the top of every submit attempt alongside `setAuthError(null)`.

- [ ] **Step 2: Render the hint banner**

Reuse the existing error banner block (L94–103) and `styles.errorBanner`. The hint is informational, not an error: render it with `color: textSecondary` text on the same `primarySurface` background, keep `accessibilityRole="alert"` so screen readers announce it. Optionally append a caption pointing at the social buttons ("Use the buttons below"), covered by the same i18n string.

## Task 5: i18n

**Files:**

- Modify: `apps/mobile/i18n/locales/en/auth.ts`
- Modify: `apps/mobile/i18n/locales/pl/auth.ts`

- [ ] **Step 1: Add keys** next to the existing `errors.*` block (~L62–70)

```ts
errors: {
  // ...
  ssoAccountHint:
    "Your account was previously used to log in with {{provider}}. Please continue with {{provider}} using the button below.",
},
```

Follow `.ai/i18n.md` for key naming; add the Polish translation in `pl/auth.ts`. The typed-keys layer (`i18next.d.ts`) picks the keys up automatically from the locale files — confirm no manual registration step is needed by checking how `resources.ts` aggregates namespaces.

## Task 6: Tests

**Files:**

- Modify: `apps/mobile/app/(auth)/__tests__/sign-in.test.tsx`

- [ ] **Step 1: Add cases**

Mock `fetchLoginProviderHint` (or the supabase `functions.invoke`) and cover:

1. Failed password login + hint says apple/no-password → banner shows the Apple hint, not "Invalid credentials".
2. Failed password login + hint says `hasPassword: true` → generic invalid-credentials error shown.
3. Hint call fails/null → generic invalid-credentials fallback.
4. Successful login unaffected.

Run the mobile test suite (`npm test` inside `apps/mobile` — confirm the script name in `package.json`) plus `npm run lint` and typecheck.

## Task 7: Docs

**Files:**

- Modify: `.ai/architecture.md`
- Link from: `docs/README.md` index if architecture section lists auth flow documents

- [ ] **Step 1:** Add a short paragraph describing the sign-in provider-hint step (failed password login → `login-provider-hint` edge function → RPC over `auth.identities`). Note the privacy trade-off decision (post-failure lookup + IP rate limiting).

---

## Out of Scope / Follow-ups

- Auto-triggering the Apple/Google sheet from the banner (needs native button tap; keep manual for now).
- Account linking (allowing password set for OAuth accounts via reset-password) — natural next feature.
- Persistent server-side rate limiting (e.g., via `pg` table) if in-memory limiting proves insufficient once deployed.
