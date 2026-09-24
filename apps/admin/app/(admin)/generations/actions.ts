"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAdminUser } from "@/lib/supabase/server";

export async function recoverStaleAttempts(formData: FormData) {
  const admin = await getAdminUser();
  if (!admin) throw new Error("Admin access required");
  const { data, error } = await admin.supabase.rpc(
    "recover_stale_generation_attempts",
    { p_user_id: null }
  );
  const requestedReturn = String(formData.get("return_to") ?? "");
  const url = new URL(
    requestedReturn.startsWith("/generations?")
      ? requestedReturn
      : "/generations",
    "http://localhost"
  );
  url.searchParams.delete("recovered");
  url.searchParams.delete("recovery_error");
  url.searchParams.set(
    error ? "recovery_error" : "recovered",
    error ? "1" : String(data ?? 0)
  );
  revalidatePath("/generations");
  redirect(url.pathname + url.search);
}
