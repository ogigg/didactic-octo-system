import { mock } from "node:test";
import type { FakeSupabase } from "./fake-supabase";

/** Thrown by the mocked `redirect()`, which never returns in Next.js either. */
export class RedirectSignal extends Error {
  readonly location: string;

  constructor(location: string) {
    super(`redirect ${location}`);
    this.location = location;
  }
}

export interface NextMocks {
  revalidated: string[];
  /** Supabase client handed to the next `createServerClient` call. */
  current: FakeSupabase | null;
}

/**
 * Mocks the Next.js server APIs and `@supabase/ssr`, so the real
 * `lib/supabase/server.ts` helpers run against `mocks.current`. Call before
 * importing the module under test.
 */
export function mockNextServer(): NextMocks {
  const mocks: NextMocks = { revalidated: [], current: null };

  // `namedExports` is deprecated on newer Node, but CI's Node 22 has no
  // `exports` option yet.
  mock.module("next/navigation", {
    namedExports: {
      redirect(location: string): never {
        throw new RedirectSignal(location);
      },
    },
  });
  mock.module("next/cache", {
    namedExports: {
      revalidatePath(path: string) {
        mocks.revalidated.push(path);
      },
    },
  });
  mock.module("next/headers", {
    namedExports: {
      async cookies() {
        return { getAll: () => [], set: () => undefined };
      },
    },
  });
  mock.module("@supabase/ssr", {
    namedExports: {
      createServerClient() {
        if (!mocks.current) throw new Error("No fake Supabase client set");
        return mocks.current.client;
      },
    },
  });

  return mocks;
}

/** Runs `action` and returns where it redirected to. */
export async function redirectOf(action: () => Promise<unknown>) {
  try {
    await action();
  } catch (error) {
    if (error instanceof RedirectSignal) return error.location;
    throw error;
  }
  throw new Error("Expected the action to redirect");
}
