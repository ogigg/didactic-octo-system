import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/supabase/server";
import { logout } from "../login/actions";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const admin = await getAdminUser();

  if (!admin) {
    redirect("/login?error=Admin%20access%20required");
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-bg-subtle p-4">
        <div className="mb-6 text-sm font-semibold">Workout Admin</div>
        <nav className="flex flex-col gap-1 text-sm">
          <Link
            href="/exercises"
            className="rounded px-3 py-2 text-text-secondary hover:bg-bg-elevated hover:text-text"
          >
            Exercises
          </Link>
          <Link
            href="/generations"
            className="rounded px-3 py-2 text-text-secondary hover:bg-bg-elevated hover:text-text"
          >
            Generations
          </Link>
        </nav>
        <form action={logout} className="mt-auto">
          <button
            type="submit"
            className="w-full rounded px-3 py-2 text-left text-sm text-text-muted hover:bg-bg-elevated hover:text-text"
          >
            Sign out
          </button>
        </form>
      </aside>
      <main className="flex-1 overflow-x-auto p-8">{children}</main>
    </div>
  );
}
