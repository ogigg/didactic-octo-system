"use server";

import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/safe-next-path";
import { isAdmin } from "@/lib/supabase/is-admin";
import { createClient } from "@/lib/supabase/server";

function loginErrorPath(message: string, next: string): string {
  const params = new URLSearchParams({ error: message });
  if (next !== "/") params.set("next", next);
  return `/login?${params}`;
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(loginErrorPath(error.message, next));
  }

  if (!(await isAdmin(supabase, data.user.id))) {
    // Local scope ends only this browser session. The default global scope
    // would also sign the account out of the mobile app.
    await supabase.auth.signOut({ scope: "local" });
    redirect(loginErrorPath("This account does not have admin access.", next));
  }

  redirect(next);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
