# Admin Dashboard

Next.js admin panel for managing the workout app. Lives in the same Supabase
project as the mobile app and reuses its auth.

## Features

- **Exercises** — list, search, create, edit, delete exercises and upload
  images to the `exercise-media` storage bucket.
- **Generations** — browse raw LLM request/response traces for every workout
  generation (`llm_generation_logs`), including reasoning content, parsed
  output, token usage, and errors. Working sets generated with a `0` kg load
  are flagged on the trace detail page.

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

## Security Model

- Auth uses Supabase email/password sessions via `@supabase/ssr` cookies;
  `middleware.ts` redirects unauthenticated visitors to `/login`.
- All data access runs with the signed-in user's JWT against RLS. Admin
  capabilities come from the `is_admin()` helper and admin-only policies added
  in `supabase/migrations/20260821000000_add_admin_role.sql` — there is no
  service-role key in the browser or server bundle.
- Regular users can never read `llm_generation_logs`; only admins have SELECT,
  and writes happen exclusively through edge functions using the service role.

## Database Changes

Apply migrations locally with:

```bash
supabase db push --local
```
