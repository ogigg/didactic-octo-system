// Every exported server action is a public POST endpoint, whatever page it is
// rendered on. These tests call each one directly as an anonymous visitor and
// as signed-in non-admins, and check it stops at the server-side admin check
// before any write, upload, RPC or cache revalidation.
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { beforeEach, describe, test } from "node:test";
import {
  AUTH_CHECK_CALLS,
  createFakeSupabase,
  type FakeSupabaseOptions,
} from "../../test/fake-supabase";
import {
  mockNextServer,
  RedirectSignal,
  redirectOf,
} from "../../test/next-mocks";

const mocks = mockNextServer();
const exerciseActions = await import("./exercises/actions");
const generationActions = await import("./generations/actions");
const loginActions = await import("../login/actions");

const appRoot = new URL("../", import.meta.url);

type Action = (formData: FormData) => Promise<unknown>;

// Adding a server action means adding it here, with a test below.
const ADMIN_ACTIONS: Record<string, Action> = {
  createExercise: exerciseActions.createExercise,
  updateExercise: exerciseActions.updateExercise,
  deleteExercise: exerciseActions.deleteExercise,
  recoverStaleAttempts: generationActions.recoverStaleAttempts,
};
const PUBLIC_ACTIONS = ["login", "logout"];

const UNAUTHORIZED_CALLERS: Record<string, FakeSupabaseOptions> = {
  "an anonymous visitor": { user: null },
  "a signed-in non-admin": {
    user: { id: "user-1" },
    profile: { is_admin: false },
  },
  "a user without a profile row": { user: { id: "user-1" }, profile: null },
  "a user whose profile lookup fails": {
    user: { id: "user-1" },
    profileError: { message: "permission denied for table profiles" },
  },
};

function hostileForm() {
  const form = new FormData();
  form.set("id", "exercise-1");
  form.set("name", "Injected exercise");
  form.set("primary_muscles", "chest");
  form.set("image", new File(["png"], "image.png", { type: "image/png" }));
  form.set("return_to", "/generations?window=24h");
  return form;
}

async function rejectionOf(action: Action) {
  try {
    await action(hostileForm());
  } catch (error) {
    if (error instanceof RedirectSignal) return `redirect ${error.location}`;
    if (error instanceof Error) return `error ${error.message}`;
  }
  return "no rejection";
}

async function sourceFiles(dir: URL): Promise<URL[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .map((entry) => pathToFileURL(join(entry.parentPath, entry.name)));
}

describe("server action authorization", () => {
  beforeEach(() => {
    mocks.current = null;
    mocks.revalidated.length = 0;
  });

  test("lists every exported server action", async () => {
    assert.deepEqual(
      [
        ...Object.keys(exerciseActions),
        ...Object.keys(generationActions),
      ].sort(),
      Object.keys(ADMIN_ACTIONS).sort()
    );
    assert.deepEqual(Object.keys(loginActions).sort(), PUBLIC_ACTIONS);

    const serverActionFiles = [];
    for (const file of await sourceFiles(appRoot)) {
      const source = await readFile(file, "utf8");
      if (/^\s*["']use server["']/.test(source)) {
        serverActionFiles.push(file.pathname.slice(appRoot.pathname.length));
      }
    }
    assert.deepEqual(serverActionFiles.sort(), [
      "(admin)/exercises/actions.ts",
      "(admin)/generations/actions.ts",
      "login/actions.ts",
    ]);
  });

  for (const [caller, options] of Object.entries(UNAUTHORIZED_CALLERS)) {
    for (const [name, action] of Object.entries(ADMIN_ACTIONS)) {
      test(`${name} rejects ${caller}`, async () => {
        const supabase = createFakeSupabase(options);
        mocks.current = supabase;

        const outcome = await rejectionOf(action);

        assert.ok(
          outcome === "redirect /login" ||
            outcome === "error Admin access required",
          outcome
        );
        assert.deepEqual(
          supabase.calls.filter((call) => !AUTH_CHECK_CALLS.has(call)),
          []
        );
        assert.deepEqual(mocks.revalidated, []);
      });
    }
  }

  describe("as an admin", () => {
    beforeEach(() => {
      mocks.current = createFakeSupabase({
        user: { id: "admin-1" },
        profile: { is_admin: true },
      });
    });

    test("deleteExercise reaches the database", async () => {
      assert.equal(
        await redirectOf(() => exerciseActions.deleteExercise(hostileForm())),
        "/exercises?deleted=1"
      );
      assert.ok(mocks.current?.calls.includes("exercises.delete"));
    });

    test("recoverStaleAttempts runs the recovery RPC", async () => {
      assert.equal(
        await redirectOf(() =>
          generationActions.recoverStaleAttempts(hostileForm())
        ),
        "/generations?window=24h&recovered=2"
      );
      assert.ok(
        mocks.current?.calls.includes("rpc.recover_stale_generation_attempts")
      );
    });

    for (const returnTo of [
      "//evil.test/generations?x=1",
      "https://evil.test/generations?x=1",
      "/generations/../exercises",
    ]) {
      test(`recoverStaleAttempts ignores return_to ${returnTo}`, async () => {
        const form = hostileForm();
        form.set("return_to", returnTo);
        assert.equal(
          await redirectOf(() => generationActions.recoverStaleAttempts(form)),
          "/generations?recovered=2"
        );
      });
    }
  });
});

describe("admin page guards", () => {
  // Pages render in parallel with the admin layout, so each page that reads
  // data must check admin access itself instead of relying on the layout.
  test("every page that loads data returns early for non-admins", async () => {
    const pages = (await sourceFiles(new URL("./", import.meta.url))).filter(
      (file) => file.pathname.endsWith("/page.tsx")
    );
    assert.ok(pages.length > 0);

    for (const page of pages) {
      const source = await readFile(page, "utf8");
      const relative = page.pathname.slice(appRoot.pathname.length);
      if (!source.includes("supabase")) continue;

      assert.ok(source.includes("await getAdminUser()"), relative);
      assert.ok(source.includes("if (!admin) return null;"), relative);
      assert.ok(!source.includes("getAdminUser())!"), relative);
    }
  });
});
