import { login } from "./actions";

interface LoginPageProps {
  searchParams: Promise<{ error?: string; next?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, next } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-bg-subtle p-8">
        <h1 className="mb-1 text-xl font-semibold">Workout Admin</h1>
        <p className="mb-6 text-sm text-text-secondary">
          Sign in with your admin account.
        </p>

        {error ? (
          <p className="mb-4 rounded border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <form action={login} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next ?? "/"} />
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-text-secondary">Email</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="rounded border border-border bg-bg-elevated px-3 py-2 outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-text-secondary">Password</span>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="rounded border border-border bg-bg-elevated px-3 py-2 outline-none focus:border-primary"
            />
          </label>
          <button
            type="submit"
            className="mt-2 rounded bg-primary px-3 py-2 font-medium text-black transition-opacity hover:opacity-90"
          >
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
