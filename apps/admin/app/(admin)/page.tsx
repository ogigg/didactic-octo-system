import Link from "next/link";
import { getAdminUser } from "@/lib/supabase/server";

export default async function AdminHomePage() {
  const { supabase } = (await getAdminUser())!;

  const [{ count: exerciseCount }, { count: attemptCount }] = await Promise.all(
    [
      supabase.from("exercises").select("*", { count: "exact", head: true }),
      supabase
        .from("generation_attempts")
        .select("*", { count: "exact", head: true }),
    ]
  );

  const stats = [
    { label: "Exercises", value: exerciseCount ?? 0, href: "/exercises" },
    {
      label: "Generation attempts",
      value: attemptCount ?? 0,
      href: "/generations",
    },
  ];

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Dashboard</h1>
      <div className="grid max-w-2xl grid-cols-2 gap-4">
        {stats.map((stat) => (
          <Link
            key={stat.href}
            href={stat.href}
            className="rounded-lg border border-border bg-bg-subtle p-6 transition-colors hover:border-primary"
          >
            <div className="text-3xl font-semibold">{stat.value}</div>
            <div className="mt-1 text-sm text-text-secondary">{stat.label}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
