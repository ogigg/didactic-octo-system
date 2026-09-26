# Admin Dashboard

Next.js admin panel for managing the workout app. Lives in the same Supabase
project as the mobile app and reuses its auth.

## Features

- **Exercises** — list, search, create, edit, delete exercises and upload
  images to the `exercise-media` storage bucket.
- **Generation control room** — monitor generation attempts across the selected
  time window with outcome, fallback, stale-running, latency, and stage-failure
  metrics. Filter by outcome, function, user UUID, or request UUID, then open a
  stage timeline with trace IDs, errors, final output, and linked model logs.
  The control room can explicitly recover stale running attempts through the
  admin-only recovery RPC; reads never trigger recovery automatically.
- **Raw model logs** — `/generations/llm` keeps the original
  `llm_generation_logs` request/response archive reachable, including reasoning
  content, parsed output, token usage, provider settings, finish reason, cost,
  and stable failure code. The page also shows database-side provider latency
  (average, p50, and p95), model-valid response rate, and linked fallback rate;
  these metrics respect admin RLS and are not calculated from the current page.
  Failed generations retain the request and partial response when available.
  Working sets generated with a `0` kg load are flagged on the trace detail
  page. A request UUID lookup searches all dates so old traces remain
  discoverable.
- **Timing split** — attempt detail pages separate provider model time from
  queue waiting (`awaiting_persistence`) and the database persistence stage.
  Missing or legacy timings remain visibly unknown instead of being reported
  as zero.

## Setup

```bash
cp .env.example .env.local   # fill in NEXT_PUBLIC_SUPABASE_URL / ANON_KEY
npm run dev --workspace=admin
```

The env values are the same project URL and anon key used by `apps/mobile`
(`EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`).

## Admin Access

1. Sign up / sign in with your account in the mobile app first (so a profile
   row exists).
2. Promote yourself with SQL (service role / SQL editor):

   ```sql
   UPDATE public.profiles SET is_admin = TRUE WHERE id = '<user-uuid>';
   ```

3. Sign in at `/login`. Non-admin accounts are rejected at login and every
   admin page re-checks `profiles.is_admin` server-side.

A rejected non-admin is signed out of the admin session only (`scope:
"local"`), so their mobile app session keeps working. A non-admin who is
already signed in, for example after losing admin rights, sees the login page
instead of being redirected back and forth between `/` and `/login`.

## Security Model

- Auth uses Supabase email/password sessions via `@supabase/ssr` cookies;
  `middleware.ts` redirects unauthenticated visitors to `/login` with the
  requested path and query in `next`.
- After login, `next` only takes same-origin paths. `lib/safe-next-path.ts`
  turns absolute URLs, protocol-relative paths (`//host`), backslashes,
  control characters, encoded separators (`%2F`, `%5C`, `%25`) and `/login`
  into `/`. The login page, the login action and the middleware all apply it.
- Every exported server action is a public POST endpoint. Each one must call
  `getAdminUser()` before it writes, uploads or runs an RPC, and each page that
  loads data returns early without an admin. The page layout's check is not
  enough on its own. `app/(admin)/actions-authorization.test.ts` fails when a
  new action or `"use server"` file is added without a matching test.
- All data access runs with the signed-in user's JWT against RLS. Admin
  capabilities come from the `is_admin()` helper and admin-only policies added
  in `supabase/migrations/20260821000000_add_admin_role.sql` — there is no
  service-role key in the browser or server bundle.
- Regular users can never read `llm_generation_logs`; only admins have SELECT,
  and writes happen exclusively through edge functions using the service role.

## Tests

```bash
npm test --workspace=admin
```

The tests use Node's built-in runner (`node --test`) and need Node 22.18 or
newer, which strips TypeScript without a build step. `test/setup.ts` resolves
the `@/` alias and extensionless imports. The Next.js server APIs and Supabase
are replaced with in-memory fakes from `test/`, so the tests never reach a
Supabase project.

## Database Changes

Apply migrations locally with:

```bash
supabase db push --local
```
