import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { createFakeSupabase } from "../../test/fake-supabase";
import { mockNextServer, redirectOf } from "../../test/next-mocks";

const mocks = mockNextServer();
const { login } = await import("./actions");

function loginForm(next?: string) {
  const form = new FormData();
  form.set("email", "admin@example.test");
  form.set("password", "correct horse");
  if (next !== undefined) form.set("next", next);
  return form;
}

function signInAsAdmin() {
  mocks.current = createFakeSupabase({
    user: { id: "admin-1" },
    profile: { is_admin: true },
  });
}

describe("login", () => {
  beforeEach(() => {
    mocks.current = null;
  });

  test("redirects an admin to a valid local destination with its query", async () => {
    signInAsAdmin();
    assert.equal(
      await redirectOf(() =>
        login(loginForm("/generations?window=7d&outcome=failed"))
      ),
      "/generations?window=7d&outcome=failed"
    );
  });

  test("redirects an admin to / without a destination", async () => {
    signInAsAdmin();
    assert.equal(await redirectOf(() => login(loginForm())), "/");
  });

  for (const next of [
    "//evil.test",
    "https://evil.test",
    "/\\evil.test",
    "/%2F%2Fevil.test",
    "/.//evil.test",
    "/\t/evil.test",
  ]) {
    test(`redirects an admin to / instead of ${JSON.stringify(next)}`, async () => {
      signInAsAdmin();
      assert.equal(await redirectOf(() => login(loginForm(next))), "/");
    });
  }

  test("signs a non-admin out of this session only and shows the error", async () => {
    mocks.current = createFakeSupabase({
      user: { id: "user-1" },
      profile: { is_admin: false },
    });

    const location = await redirectOf(() => login(loginForm("/exercises")));
    const url = new URL(location, "https://admin.example");

    assert.equal(url.pathname, "/login");
    assert.equal(
      url.searchParams.get("error"),
      "This account does not have admin access."
    );
    assert.equal(url.searchParams.get("next"), "/exercises");
    assert.ok(mocks.current.calls.includes("auth.signOut:local"));
    assert.ok(!mocks.current.calls.includes("auth.signOut:global"));
  });

  test("treats a missing profile row as a non-admin", async () => {
    mocks.current = createFakeSupabase({ user: { id: "user-1" } });

    const location = await redirectOf(() => login(loginForm()));

    assert.match(location, /^\/login\?error=/);
    assert.ok(mocks.current.calls.includes("auth.signOut:local"));
  });

  test("keeps only a safe destination when sign-in fails", async () => {
    mocks.current = createFakeSupabase({
      signInError: "Invalid login credentials",
    });

    const location = await redirectOf(() =>
      login(loginForm("/exercises?page=2"))
    );
    const url = new URL(location, "https://admin.example");

    assert.equal(url.searchParams.get("error"), "Invalid login credentials");
    assert.equal(url.searchParams.get("next"), "/exercises?page=2");
    assert.ok(!mocks.current.calls.includes("profiles.select"));

    mocks.current = createFakeSupabase({
      signInError: "Invalid login credentials",
    });
    const hostile = new URL(
      await redirectOf(() => login(loginForm("//evil.test"))),
      "https://admin.example"
    );
    assert.equal(hostile.searchParams.get("next"), null);
  });
});
