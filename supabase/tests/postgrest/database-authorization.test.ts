// Authorization regression tests that go through the real local PostgREST
// and GoTrue APIs with anon, user A, user B, admin and service-role
// credentials (SWE-205).
//
// Run against the local stack only:
//   eval "$(supabase status -o env | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')"
//   deno test --no-lock --allow-net --allow-env supabase/tests/postgrest/
//
// Fixtures are disposable users created through the auth admin API and
// deleted afterwards (profile data cascades). The suite never calls
// purge_expired_deletions as the service role; that path is covered inside a
// rolled-back transaction in supabase/tests/database-authorization.test.sql.

import {
  assert,
  assertEquals,
  assertNotEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

const apiUrl = (
  Deno.env.get("SUPABASE_URL") ??
  Deno.env.get("API_URL") ??
  ""
).replace(/\/$/, "");
const anonKey =
  Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("ANON_KEY") ?? "";
const serviceKey =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SERVICE_ROLE_KEY") ??
  "";

const configured = apiUrl !== "" && anonKey !== "" && serviceKey !== "";
if (configured) {
  const host = new URL(apiUrl).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(`Refusing to run authorization fixtures against ${host}`);
  }
}

interface Caller {
  name: string;
  apikey: string;
  token: string;
}

interface ApiResponse {
  status: number;
  body: unknown;
}

interface Fixture {
  id: string;
  email: string;
  caller: Caller;
}

const anon: Caller = { name: "anon", apikey: anonKey, token: anonKey };
const service: Caller = {
  name: "service",
  apikey: serviceKey,
  token: serviceKey,
};

async function call(
  caller: Caller,
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {}
): Promise<ApiResponse> {
  const res = await fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      apikey: caller.apikey,
      Authorization: `Bearer ${caller.token}`,
      "Content-Type": "application/json",
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  return { status: res.status, body: parsed };
}

const rest = (
  caller: Caller,
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {}
) =>
  call(caller, method, `/rest/v1/${path}`, body, {
    Prefer: "return=representation",
    ...headers,
  });

const rpc = (caller: Caller, fn: string, args: Record<string, unknown> = {}) =>
  call(caller, "POST", `/rest/v1/rpc/${fn}`, args);

function isDenied(res: ApiResponse): boolean {
  return res.status === 401 || res.status === 403;
}

function assertDenied(res: ApiResponse, label: string) {
  assert(
    isDenied(res),
    `${label}: expected 401/403, got ${res.status} ${JSON.stringify(res.body)}`
  );
}

function assertOk(res: ApiResponse, label: string) {
  assert(
    res.status >= 200 && res.status < 300,
    `${label}: expected 2xx, got ${res.status} ${JSON.stringify(res.body)}`
  );
}

async function createUser(label: string): Promise<Fixture> {
  const email = `swe205-${label}-${crypto.randomUUID()}@example.com`;
  // Throwaway per-run credential for a local fixture user.
  const passphrase = crypto.randomUUID() + crypto.randomUUID();
  const created = await call(service, "POST", "/auth/v1/admin/users", {
    email,
    password: passphrase,
    email_confirm: true,
  });
  assertOk(created, `create ${label}`);
  const id = (created.body as { id: string }).id;

  const session = await call(
    anon,
    "POST",
    "/auth/v1/token?grant_type=password",
    { email, password: passphrase }
  );
  assertOk(session, `sign in ${label}`);
  const token = (session.body as { access_token: string }).access_token;
  return { id, email, caller: { name: label, apikey: anonKey, token } };
}

async function readProfile(id: string): Promise<Record<string, unknown>> {
  const res = await rest(service, "GET", `profiles?id=eq.${id}&select=*`);
  assertOk(res, "service profile read");
  const rows = res.body as Record<string, unknown>[];
  assertEquals(rows.length, 1, "profile row exists");
  return rows[0];
}

const profileUrl = (id: string) => `profiles?id=eq.${id}`;

// llm_generation_logs.user_id is ON DELETE SET NULL, so fixture log rows are
// found by a per-run marker instead of by user.
const logMarker = `swe205-test-${crypto.randomUUID()}`;

Deno.test({
  name: "database authorization through PostgREST",
  ignore: !configured,
  sanitizeResources: false,
  sanitizeOps: false,
  async fn(t) {
    const fixtures: Fixture[] = [];
    try {
      const userA = await createUser("a");
      const userB = await createUser("b");
      const admin = await createUser("admin");
      const fresh = await createUser("fresh");
      fixtures.push(userA, userB, admin, fresh);

      await t.step("signup trigger still creates profiles", async () => {
        for (const fixture of fixtures) {
          const profile = await readProfile(fixture.id);
          assertEquals(profile.is_admin, false);
          assertEquals(profile.subscription_tier, "free");
        }
      });

      await t.step(
        "service role can still manage server-owned fields",
        async () => {
          assertOk(
            await rest(service, "PATCH", profileUrl(admin.id), {
              is_admin: true,
            }),
            "service promotes admin"
          );
          assertEquals((await rpc(admin.caller, "is_admin")).body, true);

          assertOk(
            await rpc(service, "update_subscription_status", {
              p_user_id: userB.id,
              p_tier: "pro",
              p_expires_at: null,
              p_rc_customer_id: "rc-swe205",
            }),
            "service subscription RPC"
          );
          const profileB = await readProfile(userB.id);
          assertEquals(profileB.subscription_tier, "pro");
          assertOk(
            await rest(service, "PATCH", profileUrl(userB.id), {
              subscription_tier: "free",
              subscription_expires_at: null,
              revenuecat_customer_id: null,
            }),
            "service resets subscription"
          );
        }
      );

      await t.step("user cannot self-promote to admin", async () => {
        assertDenied(
          await rest(userA.caller, "PATCH", profileUrl(userA.id), {
            is_admin: true,
          }),
          "PATCH is_admin"
        );
        assertEquals((await readProfile(userA.id)).is_admin, false);
        assertEquals((await rpc(userA.caller, "is_admin")).body, false);
      });

      await t.step(
        "user cannot grant themselves Pro, even in mixed payloads",
        async () => {
          assertDenied(
            await rest(userA.caller, "PATCH", profileUrl(userA.id), {
              training_split: "upper_lower",
              subscription_tier: "pro",
              subscription_expires_at: null,
            }),
            "mixed PATCH"
          );
          const profile = await readProfile(userA.id);
          assertEquals(profile.subscription_tier, "free");
          assertNotEquals(profile.training_split, "upper_lower");

          const allowance = await rpc(
            userA.caller,
            "check_generation_allowance",
            {
              p_user_id: userA.id,
              p_requested_count: 1000,
            }
          );
          assertOk(allowance, "allowance");
          const [row] = allowance.body as { allowed: boolean; tier: string }[];
          assertEquals(row.allowed, false);
          assertEquals(row.tier, "free");
        }
      );

      await t.step(
        "each server-owned field rejects direct user writes",
        async () => {
          const protectedPayloads: Record<string, unknown>[] = [
            { subscription_expires_at: "2099-01-01T00:00:00Z" },
            { revenuecat_customer_id: "forged" },
            { deletion_scheduled_at: "2000-01-01T00:00:00Z" },
            { initial_queue_generated_at: "2026-01-01T00:00:00Z" },
            { queue_generation_request_id: crypto.randomUUID() },
            { queue_generation_started_at: "2026-01-01T00:00:00Z" },
          ];
          for (const payload of protectedPayloads) {
            assertDenied(
              await rest(userA.caller, "PATCH", profileUrl(userA.id), payload),
              `PATCH ${Object.keys(payload)[0]}`
            );
          }
        }
      );

      await t.step("upsert cannot smuggle protected fields", async () => {
        const upsert = {
          Prefer: "resolution=merge-duplicates,return=representation",
        };
        assertDenied(
          await rest(
            userA.caller,
            "POST",
            "profiles",
            { id: userA.id, weight_unit: "lbs", is_admin: true },
            upsert
          ),
          "upsert is_admin"
        );
        assertDenied(
          await rest(
            userA.caller,
            "POST",
            "profiles",
            { id: userA.id, subscription_tier: "pro" },
            upsert
          ),
          "upsert pro"
        );
        const profile = await readProfile(userA.id);
        assertEquals(profile.is_admin, false);
        assertEquals(profile.weight_unit, "kg");

        assertOk(
          await rest(
            userA.caller,
            "POST",
            "profiles",
            {
              id: userA.id,
              weight_unit: "lbs",
              subscription_tier: "free",
              is_admin: false,
            },
            upsert
          ),
          "upsert echoing current values"
        );
        assertEquals((await readProfile(userA.id)).weight_unit, "lbs");
      });

      await t.step(
        "fresh profile INSERT must use server defaults",
        async () => {
          assertOk(
            await rest(service, "DELETE", profileUrl(fresh.id)),
            "service removes fresh profile"
          );
          assertDenied(
            await rest(fresh.caller, "POST", "profiles", {
              id: fresh.id,
              is_admin: true,
            }),
            "insert admin profile"
          );
          assertDenied(
            await rest(fresh.caller, "POST", "profiles", {
              id: fresh.id,
              subscription_tier: "pro",
            }),
            "insert pro profile"
          );
          assertOk(
            await rest(fresh.caller, "POST", "profiles", {
              id: fresh.id,
              weight_unit: "lbs",
            }),
            "insert ordinary profile"
          );
          const profile = await readProfile(fresh.id);
          assertEquals(profile.is_admin, false);
          assertEquals(profile.subscription_tier, "free");
        }
      );

      await t.step(
        "ordinary profile and onboarding edits still work",
        async () => {
          const prefs = {
            training_split: "push_pull_legs",
            session_duration_minutes: 45,
            equipment_level: "full_gym",
            training_style: "hypertrophy",
            difficulty_level: "intermediate",
            training_custom_prompt: null,
            weight_unit: "kg",
            weight_increments: { barbell: { base_kg: 2.5, micro_kg: null } },
            training_setup_completed: true,
          };
          assertOk(
            await rest(userA.caller, "PATCH", profileUrl(userA.id), prefs),
            "training preferences"
          );
          const profile = await readProfile(userA.id);
          assertEquals(profile.training_split, "push_pull_legs");
          assertEquals(profile.training_setup_completed, true);

          const onboarding = await rpc(userB.caller, "complete_onboarding", {
            p_expected_user_id: userB.id,
            p_profile: {
              goal: "build_strength",
              weekly_frequency: "3",
              training_split: "full_body",
              session_duration_minutes: 60,
              equipment_level: "full_gym",
              training_style: "strength",
              difficulty_level: "beginner",
              weight_unit: "kg",
            },
            p_baselines: [],
          });
          assertOk(onboarding, "complete_onboarding");
          assertEquals(
            (onboarding.body as { status: string }).status,
            "completed"
          );
        }
      );

      await t.step(
        "account deletion RPCs still write deletion state",
        async () => {
          assertDenied(
            await rpc(anon, "request_account_deletion", { grace_days: 14 }),
            "anon request deletion"
          );
          assertOk(
            await rpc(userB.caller, "request_account_deletion", {
              grace_days: 14,
            }),
            "request deletion"
          );
          assertNotEquals(
            (await readProfile(userB.id)).deletion_scheduled_at,
            null
          );
          assertOk(
            await rpc(userB.caller, "cancel_account_deletion"),
            "cancel deletion"
          );
          assertEquals(
            (await readProfile(userB.id)).deletion_scheduled_at,
            null
          );
        }
      );

      await t.step("admin-only data stays admin-only", async () => {
        assertOk(
          await rest(service, "POST", "llm_generation_logs", {
            user_id: userA.id,
            function_name: logMarker,
            model: "none",
            request_messages: [],
          }),
          "service log insert"
        );
        const asUser = await rest(
          userA.caller,
          "GET",
          `llm_generation_logs?function_name=eq.${logMarker}&select=id`
        );
        assertEquals(asUser.body, []);
        const asAdmin = await rest(
          admin.caller,
          "GET",
          `llm_generation_logs?function_name=eq.${logMarker}&select=id`
        );
        assertEquals((asAdmin.body as unknown[]).length, 1);
      });

      const [exercise] = (
        await rest(service, "GET", "exercises?select=id&limit=1")
      ).body as { id: string }[];

      const session = await rest(userA.caller, "POST", "workout_sessions", {
        user_id: userA.id,
        name: "SWE-205 fixture",
        goal_snapshot: "build_strength",
        status: "active",
        started_at: "2026-09-26T08:00:00Z",
      });
      assertOk(session, "user A creates session");
      const sessionId = (session.body as { id: string }[])[0].id;
      assertOk(
        await rest(userA.caller, "POST", "session_exercises", {
          workout_session_id: sessionId,
          exercise_id: exercise.id,
          order_index: 0,
        }),
        "user A adds exercise"
      );

      await t.step("workout completion trigger still fires", async () => {
        assertOk(
          await rest(
            userA.caller,
            "PATCH",
            `workout_sessions?id=eq.${sessionId}`,
            {
              status: "completed",
              completed_at: "2026-09-26T09:00:00Z",
            }
          ),
          "complete session"
        );
      });

      await t.step("workout detail is owner or service only", async () => {
        const args = { p_session_id: sessionId };
        assertDenied(
          await rpc(anon, "get_workout_session_detail", args),
          "anon detail"
        );

        const foreign = await rpc(
          userB.caller,
          "get_workout_session_detail",
          args
        );
        assertEquals(foreign.status, 400, "foreign detail is rejected");
        assertEquals(
          (foreign.body as { message: string }).message,
          "Not found or not authorized"
        );

        const own = await rpc(userA.caller, "get_workout_session_detail", args);
        assertOk(own, "own detail");
        assertEquals((own.body as { id: string }).id, sessionId);
        assertEquals(
          (own.body as { exercises: unknown[] }).exercises.length,
          1
        );

        const svc = await rpc(service, "get_workout_session_detail", args);
        assertOk(svc, "service detail");
        assertEquals((svc.body as { id: string }).id, sessionId);

        const missing = await rpc(service, "get_workout_session_detail", {
          p_session_id: crypto.randomUUID(),
        });
        assertEquals(missing.status, 400, "unknown session is rejected");
      });

      await t.step(
        "comments can only reference the caller's session",
        async () => {
          const sessionB = await rest(
            userB.caller,
            "POST",
            "workout_sessions",
            {
              user_id: userB.id,
              goal_snapshot: "build_strength",
            }
          );
          assertOk(sessionB, "user B creates session");
          const sessionBId = (sessionB.body as { id: string }[])[0].id;

          assertDenied(
            await rest(userB.caller, "POST", "workout_session_comments", {
              user_id: userB.id,
              workout_session_id: sessionId,
              comment: "cross-owner",
            }),
            "B comments on A's session"
          );
          assertDenied(
            await rest(userB.caller, "POST", "workout_session_comments", {
              user_id: userA.id,
              workout_session_id: sessionId,
              comment: "impersonation",
            }),
            "B comments as A"
          );
          assertDenied(
            await rest(anon, "POST", "workout_session_comments", {
              user_id: userA.id,
              workout_session_id: sessionId,
              comment: "anon",
            }),
            "anon comment"
          );
          assertOk(
            await rest(userB.caller, "POST", "workout_session_comments", {
              user_id: userB.id,
              workout_session_id: sessionBId,
              comment: "own session",
            }),
            "B comments on own session"
          );
          assertOk(
            await rest(userA.caller, "POST", "workout_session_comments", {
              user_id: userA.id,
              workout_session_id: sessionId,
              comment: "own session",
            }),
            "A comments on own session"
          );
          const leaked = await rest(
            service,
            "GET",
            `workout_session_comments?workout_session_id=eq.${sessionId}&user_id=eq.${userB.id}&select=id`
          );
          assertEquals(leaked.body, []);
        }
      );

      await t.step(
        "measurement date RPC compares dates and checks ownership",
        async () => {
          assertOk(
            await rest(userA.caller, "POST", "body_measurements", {
              user_id: userA.id,
              logged_at: "2026-09-01",
              weight_kg: 80,
            }),
            "A logs measurement"
          );
          const move = {
            p_user_id: userA.id,
            p_old_logged_at: "2026-09-01",
            p_new_logged_at: "2026-09-02",
          };
          assertDenied(
            await rpc(anon, "update_body_measurement_date", move),
            "anon move"
          );
          assertDenied(
            await rpc(userB.caller, "update_body_measurement_date", move),
            "B moves A"
          );
          assertOk(
            await rpc(userA.caller, "update_body_measurement_date", move),
            "A moves own"
          );

          const rows = (
            await rest(
              service,
              "GET",
              `body_measurements?user_id=eq.${userA.id}&select=logged_at`
            )
          ).body as { logged_at: string }[];
          assertEquals(rows, [{ logged_at: "2026-09-02" }]);
        }
      );

      await t.step(
        "maintenance and service-only RPCs reject clients",
        async () => {
          // Never let a regression run a real purge: only probe client access
          // while no account in this database is past its deletion date.
          const expired = await rest(
            service,
            "GET",
            `profiles?deletion_scheduled_at=lte.${new Date().toISOString()}&select=id`
          );
          assertOk(expired, "expired deletion precondition");
          assertEquals(
            expired.body,
            [],
            "no expired deletions before purge probes"
          );

          // Denied at the privilege check, before the function body runs.
          assertDenied(
            await rpc(anon, "purge_expired_deletions"),
            "anon purge"
          );
          assertDenied(
            await rpc(userA.caller, "purge_expired_deletions"),
            "user purge"
          );
          assertDenied(
            await rpc(admin.caller, "purge_expired_deletions"),
            "admin purge"
          );

          const hintArgs = { p_email: userA.email };
          assertDenied(
            await rpc(anon, "get_login_provider_hint", hintArgs),
            "anon hint"
          );
          assertDenied(
            await rpc(userB.caller, "get_login_provider_hint", hintArgs),
            "user hint"
          );
          const hint = await rpc(service, "get_login_provider_hint", hintArgs);
          assertOk(hint, "service hint");
          assertEquals(
            (hint.body as { has_password: boolean }).has_password,
            true
          );

          for (const fn of [
            "handle_new_user",
            "notify_workout_completed",
            "guard_profile_server_owned_fields",
          ]) {
            const res = await rpc(userA.caller, fn);
            assert(res.status >= 400, `${fn} is not callable (${res.status})`);
          }
        }
      );

      await t.step(
        "catalog, storage and server tables reject user writes",
        async () => {
          assertDenied(
            await rest(userA.caller, "POST", "exercises", {
              name: "Forged",
              primary_muscles: [],
              equipment: [],
            }),
            "user exercise insert"
          );
          assertDenied(
            await rest(userA.caller, "POST", "catalog_label_translations", {
              label_type: "muscle",
              label_key: "Forged",
              language_code: "pl",
              display_name: "Forged",
            }),
            "user label insert"
          );
          assertDenied(
            await rest(userA.caller, "POST", "generation_usage", {
              user_id: userA.id,
              generation_trigger: "regeneration",
            }),
            "user usage insert"
          );
          assertDenied(
            await rest(userA.caller, "POST", "llm_generation_logs", {
              function_name: "forged",
              model: "none",
              request_messages: [],
            }),
            "user log insert"
          );
          const upload = await fetch(
            `${apiUrl}/storage/v1/object/exercise-media/swe205/${crypto.randomUUID()}.png`,
            {
              method: "POST",
              headers: {
                apikey: anonKey,
                Authorization: `Bearer ${userA.caller.token}`,
                "Content-Type": "image/png",
              },
              body: new Uint8Array([137, 80, 78, 71]),
            }
          );
          const uploadBody = await upload.text();
          if (upload.status === 503) {
            // The local stack can run without the storage container; the
            // storage.objects policies are also covered in the pgTAP suite.
            console.warn("storage API unavailable, skipping upload probe");
          } else {
            assert(
              uploadBody.includes("row-level security"),
              `user storage upload rejected by RLS (${upload.status} ${uploadBody})`
            );
          }

          const catalog = await rest(
            userA.caller,
            "GET",
            "exercises?select=id&limit=1"
          );
          assertOk(catalog, "authenticated catalog read");
          assertEquals((catalog.body as unknown[]).length, 1);
        }
      );
    } finally {
      await rest(
        service,
        "DELETE",
        `llm_generation_logs?function_name=eq.${logMarker}`
      );
      for (const fixture of fixtures) {
        const res = await call(
          service,
          "DELETE",
          `/auth/v1/admin/users/${fixture.id}`
        );
        if (res.status >= 300) {
          console.error(`cleanup failed for ${fixture.id}: ${res.status}`);
        }
      }
    }
  },
});
