import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { NextRequest } from "next/server";
import { createFakeSupabase } from "./test/fake-supabase";
import { mockNextServer } from "./test/next-mocks";

const mocks = mockNextServer();
const { middleware } = await import("./middleware");

const ORIGIN = "https://admin.example";

async function visit(path: string) {
  const response = await middleware(new NextRequest(`${ORIGIN}${path}`));
  return response.headers.get("location");
}

describe("middleware", () => {
  beforeEach(() => {
    mocks.current = null;
  });

  describe("signed out", () => {
    beforeEach(() => {
      mocks.current = createFakeSupabase({ user: null });
    });

    test("sends admin pages to /login with the path and query as next", async () => {
      const location = new URL(
        (await visit("/generations?window=7d&outcome=failed")) ?? ""
      );

      assert.equal(location.origin, ORIGIN);
      assert.equal(location.pathname, "/login");
      assert.deepEqual(
        [...location.searchParams],
        [["next", "/generations?window=7d&outcome=failed"]]
      );
    });

    test("does not carry a hostile path into next", async () => {
      const location = new URL((await visit("//evil.test")) ?? "");

      assert.equal(location.origin, ORIGIN);
      assert.equal(location.searchParams.get("next"), "/");
    });

    test("lets the login page render", async () => {
      assert.equal(await visit("/login?next=%2Fexercises"), null);
    });
  });

  describe("signed in as an admin", () => {
    beforeEach(() => {
      mocks.current = createFakeSupabase({
        user: { id: "admin-1" },
        profile: { is_admin: true },
      });
    });

    test("lets admin pages through", async () => {
      assert.equal(await visit("/exercises"), null);
    });

    test("sends /login on to a valid next destination", async () => {
      assert.equal(
        await visit("/login?next=%2Fexercises%3Fpage%3D2"),
        `${ORIGIN}/exercises?page=2`
      );
    });

    for (const next of [
      "//evil.test",
      "https://evil.test",
      "/%5Cevil.test",
      "/.//evil.test",
    ]) {
      test(`sends /login to / instead of next=${next}`, async () => {
        assert.equal(
          await visit(`/login?next=${encodeURIComponent(next)}`),
          `${ORIGIN}/`
        );
      });
    }
  });

  // The admin layout redirects signed-in non-admins to /login. The middleware
  // used to bounce every signed-in visitor from /login to /, which looped.
  for (const [caller, options] of Object.entries({
    "a non-admin": { user: { id: "user-1" }, profile: { is_admin: false } },
    "a user whose profile lookup fails": {
      user: { id: "user-1" },
      profileError: { message: "network error" },
    },
  })) {
    test(`lets ${caller} see the login page instead of looping`, async () => {
      mocks.current = createFakeSupabase(options);

      assert.equal(await visit("/"), null);
      assert.equal(await visit("/login?error=Admin%20access%20required"), null);
    });
  }
});
