// In-memory stand-in for the Supabase client. It never touches the network and
// records every call as `area.method` (for example `exercises.insert`) so tests
// can prove which reads and writes an action reached.

export interface FakeSupabaseOptions {
  /** Signed-in user returned by `auth.getUser` and `signInWithPassword`. */
  user?: { id: string } | null;
  /** Row returned for the `profiles` lookup; `null` means no row. */
  profile?: { is_admin: boolean } | null;
  /** Error returned for the `profiles` lookup. */
  profileError?: { message: string };
  /** Makes `signInWithPassword` fail with this message. */
  signInError?: string;
}

export interface FakeSupabase {
  calls: string[];
  client: object;
}

/** Calls the admin guard makes before it knows who the caller is. */
export const AUTH_CHECK_CALLS = new Set([
  "auth.getUser",
  "profiles.select",
  "profiles.eq",
  "profiles.single",
]);

export function createFakeSupabase(
  options: FakeSupabaseOptions = {}
): FakeSupabase {
  const { user = null, profile = null, profileError, signInError } = options;
  const calls: string[] = [];

  function query(table: string) {
    const result =
      table === "profiles"
        ? { data: profileError ? null : profile, error: profileError ?? null }
        : { data: { id: "exercise-1" }, error: null, count: 0 };
    const builder: Record<string, unknown> = {
      then: (resolve: (value: unknown) => unknown) => resolve(result),
    };
    for (const method of [
      "select",
      "insert",
      "update",
      "upsert",
      "delete",
      "eq",
      "single",
    ]) {
      builder[method] = () => {
        calls.push(`${table}.${method}`);
        return builder;
      };
    }
    return builder;
  }

  const client = {
    auth: {
      async getUser() {
        calls.push("auth.getUser");
        return { data: { user }, error: null };
      },
      async signInWithPassword() {
        calls.push("auth.signInWithPassword");
        return signInError
          ? {
              data: { user: null, session: null },
              error: { message: signInError },
            }
          : { data: { user, session: {} }, error: null };
      },
      async signOut(signOutOptions?: { scope?: string }) {
        calls.push(`auth.signOut:${signOutOptions?.scope ?? "global"}`);
        return { error: null };
      },
    },
    from: (table: string) => query(table),
    async rpc(name: string) {
      calls.push(`rpc.${name}`);
      return { data: 2, error: null };
    },
    storage: {
      from: (bucket: string) => ({
        async upload() {
          calls.push(`storage.${bucket}.upload`);
          return { error: null };
        },
        getPublicUrl() {
          calls.push(`storage.${bucket}.getPublicUrl`);
          return { data: { publicUrl: "https://storage.test/image.png" } };
        },
      }),
    },
  };

  return { calls, client };
}
